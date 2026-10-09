begin;

alter type public.payment_method
  add value if not exists 'payment_before_delivery_on_whatsapp';

alter table public.orders
  add column is_accra boolean,
  add column accepted_advance_payment boolean;

drop function public.create_guest_order(
  uuid, text, text, text, text, jsonb
);

create function public.create_guest_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_area text,
  p_delivery_address text,
  p_is_accra boolean,
  p_accepts_advance_payment boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_zone_id uuid;
  v_delivery_area text;
  v_response jsonb;
  v_saved_delivery_area text;
  v_saved_is_accra boolean;
  v_saved_payment_method public.payment_method;
begin
  v_delivery_area := pg_catalog.btrim(coalesce(p_delivery_area, ''));
  if pg_catalog.char_length(v_delivery_area) not between 2 and 120 then
    raise exception using
      errcode = '22023',
      message = 'Enter a delivery area between 2 and 120 characters.';
  end if;

  if p_is_accra is null then
    raise exception using
      errcode = '22023',
      message = 'Please specify whether the delivery address is in Accra.';
  end if;

  if p_accepts_advance_payment is distinct from (not p_is_accra) then
    raise exception using
      errcode = '22023',
      message = 'Confirm the payment arrangement required for your delivery location.';
  end if;

  select zone.id
  into v_delivery_zone_id
  from public.delivery_zones as zone
  where zone.code = 'accra-whatsapp-confirmation'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'The delivery configuration is unavailable.';
  end if;

  update public.delivery_zones
  set active = true
  where id = v_delivery_zone_id;

  v_response := private.create_guest_order_with_zone(
    p_idempotency_key,
    p_customer_name,
    p_customer_phone,
    v_delivery_zone_id,
    p_delivery_address,
    p_items
  );

  update public.orders
  set
    delivery_area = v_delivery_area,
    is_accra = p_is_accra,
    accepted_advance_payment = p_accepts_advance_payment,
    payment_method = case
      when p_is_accra then 'cash_on_delivery'::public.payment_method
      else 'payment_before_delivery_on_whatsapp'::public.payment_method
    end
  where idempotency_key = p_idempotency_key
    and is_accra is null;

  update public.delivery_zones
  set active = false
  where id = v_delivery_zone_id;

  select
    order_record.delivery_area,
    order_record.is_accra,
    order_record.payment_method
  into
    v_saved_delivery_area,
    v_saved_is_accra,
    v_saved_payment_method
  from public.orders as order_record
  where order_record.idempotency_key = p_idempotency_key;

  v_response := pg_catalog.jsonb_set(
    v_response,
    '{delivery_area}',
    pg_catalog.to_jsonb(v_saved_delivery_area),
    true
  );
  v_response := pg_catalog.jsonb_set(
    v_response,
    '{delivery_zone}',
    pg_catalog.to_jsonb(v_saved_delivery_area),
    true
  );
  v_response := pg_catalog.jsonb_set(
    v_response,
    '{is_accra}',
    pg_catalog.to_jsonb(v_saved_is_accra),
    true
  );
  return pg_catalog.jsonb_set(
    v_response,
    '{payment_method}',
    pg_catalog.to_jsonb(v_saved_payment_method::text),
    true
  );
end;
$$;

revoke all on function public.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb
) to anon, authenticated;

comment on column public.orders.is_accra is
  'Whether the customer confirmed the delivery address is in Accra; null for orders before this checkout field was introduced.';
comment on column public.orders.accepted_advance_payment is
  'Whether a customer outside Accra accepted arranging payment before delivery on WhatsApp.';

notify pgrst, 'reload schema';

commit;
