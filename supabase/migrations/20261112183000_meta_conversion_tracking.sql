begin;

create extension if not exists pg_net with schema net;
create extension if not exists supabase_vault with schema vault;

create table private.order_attribution (
  order_id uuid primary key references public.orders(id) on delete cascade,
  fbp text,
  fbc text,
  page_url text not null,
  user_agent text not null,
  meta_consent boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint order_attribution_fbp_length
    check (fbp is null or octet_length(fbp) <= 250),
  constraint order_attribution_fbc_length
    check (fbc is null or octet_length(fbc) <= 250),
  constraint order_attribution_page_url_length
    check (octet_length(page_url) between 1 and 2048),
  constraint order_attribution_page_url_protocol
    check (page_url ~ '^https?://'),
  constraint order_attribution_user_agent_length
    check (octet_length(user_agent) <= 1024)
);

comment on table private.order_attribution is
  'Restricted checkout attribution captured for the order; never exposed through the browser API.';

alter table private.order_attribution enable row level security;
revoke all on table private.order_attribution from public, anon, authenticated;

alter table public.orders
  add column meta_purchase_sent_at timestamptz,
  add column meta_purchase_claimed_at timestamptz;

comment on column public.orders.meta_purchase_sent_at is
  'Set only after Meta accepts this order Purchase event; the stable event ID also deduplicates retries.';

alter function public.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb
) set schema private;

alter function private.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb
) rename to create_guest_order_without_attribution;

revoke all on function private.create_guest_order_without_attribution(
  uuid, text, text, text, text, boolean, boolean, jsonb
) from public, anon, authenticated;

create function public.create_guest_order(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_area text,
  p_delivery_address text,
  p_is_accra boolean,
  p_accepts_advance_payment boolean,
  p_items jsonb,
  p_fbp text,
  p_fbc text,
  p_page_url text,
  p_user_agent text,
  p_meta_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_response jsonb;
  v_order_id uuid;
  v_page_url text;
  v_user_agent text;
begin
  if p_meta_consent is null
    or (p_fbp is not null and pg_catalog.octet_length(p_fbp) > 250)
    or (p_fbc is not null and pg_catalog.octet_length(p_fbc) > 250)
    or p_page_url is null
    or pg_catalog.octet_length(p_page_url) > 2048
    or p_page_url !~ '^https?://'
    or p_user_agent is null
    or pg_catalog.octet_length(p_user_agent) > 1024 then
    raise exception using
      errcode = '22023',
      message = 'Checkout attribution data is invalid.';
  end if;

  v_response := private.create_guest_order_without_attribution(
    p_idempotency_key,
    p_customer_name,
    p_customer_phone,
    p_delivery_area,
    p_delivery_address,
    p_is_accra,
    p_accepts_advance_payment,
    p_items
  );

  select order_record.id
  into v_order_id
  from public.orders as order_record
  where order_record.idempotency_key = p_idempotency_key;

  if v_order_id is null then
    raise exception 'The created order could not be matched to its attribution.';
  end if;

  v_page_url := pg_catalog.btrim(p_page_url);
  v_user_agent := pg_catalog.btrim(p_user_agent);

  insert into private.order_attribution (
    order_id,
    fbp,
    fbc,
    page_url,
    user_agent,
    meta_consent
  )
  values (
    v_order_id,
    case when p_meta_consent then nullif(pg_catalog.btrim(p_fbp), '') end,
    case when p_meta_consent then nullif(pg_catalog.btrim(p_fbc), '') end,
    v_page_url,
    v_user_agent,
    p_meta_consent
  )
  on conflict (order_id) do nothing;

  return v_response;
end;
$$;

revoke all on function public.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb,
  text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_guest_order(
  uuid, text, text, text, text, boolean, boolean, jsonb,
  text, text, text, text, boolean
) to anon, authenticated;

create function public.claim_meta_purchase(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_attribution private.order_attribution%rowtype;
  v_items jsonb;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('status', 'missing');
  end if;
  if v_order.order_status <> 'completed' then
    return pg_catalog.jsonb_build_object('status', 'not_completed');
  end if;
  if v_order.meta_purchase_sent_at is not null then
    return pg_catalog.jsonb_build_object('status', 'already_sent');
  end if;
  if v_order.meta_purchase_claimed_at > statement_timestamp() - interval '10 minutes' then
    return pg_catalog.jsonb_build_object('status', 'in_progress');
  end if;

  select *
  into v_attribution
  from private.order_attribution
  where order_id = p_order_id;

  if not found or not v_attribution.meta_consent then
    return pg_catalog.jsonb_build_object('status', 'no_marketing_consent');
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', coalesce(item.product_id::text, item.product_name_snapshot),
        'quantity', item.quantity,
        'item_price', item.unit_price
      )
      order by item.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items as item
  where item.order_id = p_order_id;

  update public.orders
  set meta_purchase_claimed_at = statement_timestamp()
  where id = p_order_id;

  return pg_catalog.jsonb_build_object(
    'status', 'claimed',
    'event_id', 'order_' || p_order_id::text,
    'event_time', floor(extract(epoch from v_order.created_at))::bigint,
    'event_source_url', v_attribution.page_url,
    'user_data', pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'fbp', v_attribution.fbp,
        'fbc', v_attribution.fbc,
        'client_user_agent', nullif(v_attribution.user_agent, '')
      )
    ),
    'custom_data', pg_catalog.jsonb_build_object(
      'currency', 'GHS',
      'value', v_order.total,
      'order_id', v_order.order_number,
      'content_type', 'product',
      'contents', v_items,
      'num_items', (
        select coalesce(sum(item.quantity), 0)
        from public.order_items as item
        where item.order_id = p_order_id
      )
    )
  );
end;
$$;

create function public.mark_meta_purchase_sent(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set
    meta_purchase_sent_at = statement_timestamp(),
    meta_purchase_claimed_at = null
  where id = p_order_id
    and order_status = 'completed'
    and meta_purchase_sent_at is null
    and meta_purchase_claimed_at is not null;

  if not found then
    raise exception 'The Meta Purchase claim could not be marked as sent.';
  end if;
end;
$$;

create function public.release_meta_purchase_claim(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set meta_purchase_claimed_at = null
  where id = p_order_id
    and meta_purchase_sent_at is null;
end;
$$;

revoke all on function public.claim_meta_purchase(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_meta_purchase_sent(uuid)
  from public, anon, authenticated;
revoke all on function public.release_meta_purchase_claim(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_meta_purchase(uuid) to service_role;
grant execute on function public.mark_meta_purchase_sent(uuid) to service_role;
grant execute on function public.release_meta_purchase_claim(uuid) to service_role;

create function private.invoke_meta_purchase_function()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_function_url text;
  v_hook_secret text;
begin
  select decrypted_secret
  into v_function_url
  from vault.decrypted_secrets
  where name = 'meta_purchase_function_url'
  order by created_at desc
  limit 1;

  select decrypted_secret
  into v_hook_secret
  from vault.decrypted_secrets
  where name = 'meta_purchase_hook_secret'
  order by created_at desc
  limit 1;

  if v_function_url is null or v_hook_secret is null then
    raise exception 'Meta Purchase webhook secrets are missing from Supabase Vault.';
  end if;

  perform net.http_post(
    url := v_function_url,
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_hook_secret
    ),
    body := pg_catalog.jsonb_build_object('order_id', new.id)
  );

  return new;
end;
$$;

create trigger orders_invoke_meta_purchase
  after update of order_status on public.orders
  for each row
  when (
    new.order_status = 'completed'
    and old.order_status is distinct from new.order_status
  )
  execute function private.invoke_meta_purchase_function();

revoke all on function private.invoke_meta_purchase_function()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
