begin;

alter table public.products
  add column key_features text not null default '',
  add column availability text not null default 'in-stock'
    check (availability in ('in-stock', 'out-of-stock'));

alter table public.product_variants
  alter column stock_quantity drop not null;

comment on column public.products.availability is
  'Product-level availability managed from the catalogue spreadsheet.';
comment on column public.product_variants.stock_quantity is
  'A numeric quantity when tracked; NULL means availability is managed at product level.';

create or replace function private.restore_inventory_on_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_line record;
begin
  if new.order_status = 'cancelled'
    and old.order_status is distinct from new.order_status
    and old.inventory_released_at is null then
    for order_line in
      select item.variant_id, item.quantity
      from public.order_items as item
      where item.order_id = new.id
        and item.variant_id is not null
      order by item.variant_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + order_line.quantity
      where id = order_line.variant_id
        and stock_quantity is not null;
    end loop;

    update public.orders
    set inventory_released_at = statement_timestamp()
    where id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.create_guest_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_zone_id uuid,
  p_delivery_address text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_order_id uuid;
  v_order_id uuid;
  v_response jsonb;
  v_customer_name text;
  v_customer_phone text;
  v_phone_digits text;
  v_delivery_address text;
  v_delivery_zone_name text;
  v_delivery_fee numeric(10, 2);
  v_subtotal numeric := 0;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_quantity_text text;
  v_seen_variant_ids uuid[] := array[]::uuid[];
  v_item jsonb;
  v_saved_item jsonb;
  v_product_name text;
  v_size text;
  v_unit_price numeric(10, 2);
  v_stock_quantity integer;
  v_product_availability text;
  v_line_subtotal numeric;
  v_order_items jsonb := '[]'::jsonb;
begin
  if p_idempotency_key is null then
    raise exception using
      errcode = '22023',
      message = 'An order submission key is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text, 0)
  );

  select order_record.id
  into v_existing_order_id
  from public.orders as order_record
  where order_record.idempotency_key = p_idempotency_key;

  if found then
    select pg_catalog.jsonb_build_object(
      'order_number', order_record.order_number,
      'subtotal', order_record.subtotal,
      'delivery_fee', order_record.delivery_fee,
      'total', order_record.total,
      'payment_method', order_record.payment_method,
      'payment_status', order_record.payment_status,
      'order_status', order_record.order_status,
      'delivery_status', order_record.delivery_status,
      'delivery_zone', order_record.delivery_zone_name_snapshot,
      'items', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'product_name', item.product_name_snapshot,
              'size', item.size_snapshot,
              'unit_price', item.unit_price,
              'quantity', item.quantity,
              'subtotal', item.line_subtotal
            )
            order by item.product_name_snapshot, item.size_snapshot
          )
          from public.order_items as item
          where item.order_id = order_record.id
        ),
        '[]'::jsonb
      )
    )
    into v_response
    from public.orders as order_record
    where order_record.id = v_existing_order_id;

    return v_response;
  end if;

  v_customer_name := pg_catalog.btrim(coalesce(p_customer_name, ''));
  if pg_catalog.char_length(v_customer_name) not between 2 and 120 then
    raise exception using
      errcode = '22023',
      message = 'Enter a name between 2 and 120 characters.';
  end if;

  v_phone_digits := pg_catalog.regexp_replace(
    coalesce(p_customer_phone, ''),
    '[^0-9]',
    '',
    'g'
  );
  if v_phone_digits ~ '^0[235][0-9]{8}$' then
    v_customer_phone := '+233' || pg_catalog.substr(v_phone_digits, 2);
  elsif v_phone_digits ~ '^233[235][0-9]{8}$' then
    v_customer_phone := '+' || v_phone_digits;
  else
    raise exception using
      errcode = '22023',
      message = 'Enter a valid Ghanaian phone number.';
  end if;

  v_delivery_address := pg_catalog.btrim(coalesce(p_delivery_address, ''));
  if pg_catalog.char_length(v_delivery_address) not between 3 and 500 then
    raise exception using
      errcode = '22023',
      message = 'Enter a delivery address between 3 and 500 characters.';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'Order items must be provided as a JSON array.';
  end if;

  if pg_catalog.jsonb_array_length(p_items) not between 1 and 50 then
    raise exception using
      errcode = '22023',
      message = 'An order must contain between 1 and 50 distinct variants.';
  end if;

  for v_item in
    select input_item.value
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object'
      or not (
        v_item ? 'product_id'
        and v_item ? 'variant_id'
        and v_item ? 'quantity'
      )
      or v_item - 'product_id' - 'variant_id' - 'quantity' <> '{}'::jsonb then
      raise exception using
        errcode = '22023',
        message = 'Each order item must contain only product_id, variant_id, and quantity.';
    end if;

    if pg_catalog.jsonb_typeof(v_item -> 'product_id') <> 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'variant_id') <> 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'quantity') <> 'number' then
      raise exception using
        errcode = '22023',
        message = 'Order item identifiers must be strings and quantity must be an integer.';
    end if;

    if (v_item ->> 'product_id') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (v_item ->> 'variant_id') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception using
        errcode = '22023',
        message = 'Order item identifiers must be valid UUIDs.';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity_text := v_item ->> 'quantity';
    if v_quantity_text !~ '^[1-9][0-9]*$' then
      raise exception using
        errcode = '22023',
        message = 'Order item quantity must be a positive whole number.';
    end if;
    v_quantity := v_quantity_text::integer;

    if v_variant_id = any(v_seen_variant_ids) then
      raise exception using
        errcode = '22023',
        message = 'Each variant may appear only once in an order.';
    end if;
    v_seen_variant_ids := pg_catalog.array_append(v_seen_variant_ids, v_variant_id);
  end loop;

  select zone.name, zone.delivery_fee
  into v_delivery_zone_name, v_delivery_fee
  from public.delivery_zones as zone
  where zone.id = p_delivery_zone_id
    and zone.active
  for share;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'The selected delivery area is unavailable.';
  end if;

  for v_item in
    select input_item.value
    from pg_catalog.jsonb_array_elements(p_items) as input_item(value)
    order by (input_item.value ->> 'variant_id')::uuid
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := (v_item ->> 'variant_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select
      product.name,
      variant.size,
      product.price,
      variant.stock_quantity,
      product.availability
    into
      v_product_name,
      v_size,
      v_unit_price,
      v_stock_quantity,
      v_product_availability
    from public.product_variants as variant
    join public.products as product on product.id = variant.product_id
    where variant.id = v_variant_id
      and variant.product_id = v_product_id
      and variant.active
      and product.active
    for update of product, variant;

    if not found then
      raise exception using
        errcode = '22023',
        message = 'A selected product or size is no longer available.';
    end if;

    if v_product_availability = 'out-of-stock'
      or (
        v_stock_quantity is not null
        and v_quantity > v_stock_quantity
      ) then
      raise exception using
        errcode = '22023',
        message = 'The selected quantity is no longer in stock.';
    end if;

    v_line_subtotal := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_line_subtotal;

    update public.product_variants
    set stock_quantity = case
      when stock_quantity is null then null
      else stock_quantity - v_quantity
    end
    where id = v_variant_id;

    v_order_items := v_order_items || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'product_id', v_product_id,
        'variant_id', v_variant_id,
        'product_name', v_product_name,
        'size', v_size,
        'unit_price', v_unit_price,
        'quantity', v_quantity,
        'subtotal', v_line_subtotal
      )
    );
  end loop;

  insert into public.orders (
    idempotency_key,
    customer_name,
    customer_phone,
    delivery_zone_id,
    delivery_zone_name_snapshot,
    delivery_address,
    delivery_fee,
    subtotal,
    total
  )
  values (
    p_idempotency_key,
    v_customer_name,
    v_customer_phone,
    p_delivery_zone_id,
    v_delivery_zone_name,
    v_delivery_address,
    v_delivery_fee,
    v_subtotal,
    v_subtotal + v_delivery_fee
  )
  returning id into v_order_id;

  for v_saved_item in
    select saved_item.value
    from pg_catalog.jsonb_array_elements(v_order_items) as saved_item(value)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name_snapshot,
      size_snapshot,
      unit_price,
      quantity,
      line_subtotal
    )
    values (
      v_order_id,
      (v_saved_item ->> 'product_id')::uuid,
      (v_saved_item ->> 'variant_id')::uuid,
      v_saved_item ->> 'product_name',
      v_saved_item ->> 'size',
      (v_saved_item ->> 'unit_price')::numeric,
      (v_saved_item ->> 'quantity')::integer,
      (v_saved_item ->> 'subtotal')::numeric
    );
  end loop;

  select pg_catalog.jsonb_build_object(
    'order_number', order_record.order_number,
    'subtotal', order_record.subtotal,
    'delivery_fee', order_record.delivery_fee,
    'total', order_record.total,
    'payment_method', order_record.payment_method,
    'payment_status', order_record.payment_status,
    'order_status', order_record.order_status,
    'delivery_status', order_record.delivery_status,
    'delivery_zone', order_record.delivery_zone_name_snapshot,
    'items', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'product_name', item.product_name_snapshot,
            'size', item.size_snapshot,
            'unit_price', item.unit_price,
            'quantity', item.quantity,
            'subtotal', item.line_subtotal
          )
          order by item.product_name_snapshot, item.size_snapshot
        )
        from public.order_items as item
        where item.order_id = order_record.id
      ),
      '[]'::jsonb
    )
  )
  into v_response
  from public.orders as order_record
  where order_record.id = v_order_id;

  return v_response;
end;
$$;

commit;
