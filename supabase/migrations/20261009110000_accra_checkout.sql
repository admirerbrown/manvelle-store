begin;

alter table public.orders
  add column delivery_area text;

update public.orders
set delivery_area = delivery_zone_name_snapshot
where char_length(btrim(delivery_zone_name_snapshot)) between 2 and 120;

alter table public.orders
  add constraint orders_delivery_area_length_check
    check (
      delivery_area is null
      or char_length(btrim(delivery_area)) between 2 and 120
    );

insert into public.delivery_zones (code, name, delivery_fee, active)
values (
  'accra-whatsapp-confirmation',
  'Accra - delivery fee confirmed on WhatsApp',
  0,
  false
)
on conflict (code) do update
set
  name = excluded.name,
  delivery_fee = 0,
  active = false;

alter function public.create_guest_order(
  uuid, text, text, uuid, text, jsonb
) set schema private;

alter function private.create_guest_order(
  uuid, text, text, uuid, text, jsonb
) rename to create_guest_order_with_zone;

revoke all on function private.create_guest_order_with_zone(
  uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated;

create function public.create_guest_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_area text,
  p_delivery_address text,
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
begin
  v_delivery_area := pg_catalog.btrim(coalesce(p_delivery_area, ''));
  if pg_catalog.char_length(v_delivery_area) not between 2 and 120 then
    raise exception using
      errcode = '22023',
      message = 'Enter a delivery area between 2 and 120 characters.';
  end if;

  select zone.id
  into v_delivery_zone_id
  from public.delivery_zones as zone
  where zone.code = 'accra-whatsapp-confirmation'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'The Accra delivery configuration is unavailable.';
  end if;

  -- The existing secure order function still requires an active zone; keep this
  -- internal zero-fee zone inactive outside this transaction.
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
  set delivery_area = v_delivery_area
  where idempotency_key = p_idempotency_key;

  update public.delivery_zones
  set active = false
  where id = v_delivery_zone_id;

  v_response := pg_catalog.jsonb_set(
    v_response,
    '{delivery_area}',
    pg_catalog.to_jsonb(v_delivery_area),
    true
  );
  return pg_catalog.jsonb_set(
    v_response,
    '{delivery_zone}',
    pg_catalog.to_jsonb(v_delivery_area),
    true
  );
end;
$$;

revoke all on function public.create_guest_order(
  uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_guest_order(
  uuid, text, text, text, text, jsonb
) to anon, authenticated;

comment on column public.orders.delivery_area is
  'Customer-entered Accra neighbourhood; delivery fee is confirmed on WhatsApp.';

notify pgrst, 'reload schema';

commit;
