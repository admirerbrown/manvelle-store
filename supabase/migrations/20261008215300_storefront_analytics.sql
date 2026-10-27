begin;

create extension if not exists pg_cron with schema pg_catalog;

create table private.storefront_events (
  id bigint generated always as identity primary key,
  event_name text not null check (
    event_name in (
      'page_view',
      'product_view',
      'product_variant_selected',
      'add_to_cart',
      'checkout_started',
      'order_created',
      'order_confirmed',
      'order_delivered',
      'order_paid'
    )
  ),
  session_id uuid,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer check (quantity is null or quantity > 0),
  metadata jsonb not null default '{}'::jsonb
    check (
      pg_catalog.jsonb_typeof(metadata) = 'object'
      and pg_catalog.octet_length(metadata::text) <= 256
    ),
  created_at timestamptz not null default statement_timestamp(),
  constraint storefront_events_has_session_or_order
    check (session_id is not null or order_id is not null)
);

comment on table private.storefront_events is
  'Private, append-only funnel events. Contains no customer contact or address data.';
comment on column private.storefront_events.session_id is
  'Short-lived random browser session identifier; null for server-only order lifecycle events.';
comment on column private.storefront_events.metadata is
  'Restricted to a small page label for page_view events; never store customer-entered values.';

alter table private.storefront_events enable row level security;
revoke all on table private.storefront_events from public, anon, authenticated;

create index storefront_events_name_created_idx
  on private.storefront_events (event_name, created_at);
create index storefront_events_session_created_idx
  on private.storefront_events (session_id, created_at)
  where session_id is not null;
create index storefront_events_product_created_idx
  on private.storefront_events (product_id, created_at)
  where product_id is not null;
create unique index storefront_events_order_name_key
  on private.storefront_events (order_id, event_name)
  where order_id is not null
    and event_name in (
      'order_created',
      'order_confirmed',
      'order_delivered',
      'order_paid'
    );

create function private.log_order_created_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.storefront_events (event_name, order_id)
  values ('order_created', new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger orders_log_created_event
  after insert on public.orders
  for each row execute function private.log_order_created_event();
revoke all on function private.log_order_created_event()
  from public, anon, authenticated;

create function private.log_order_lifecycle_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivery_status = 'delivered'
    and old.delivery_status is distinct from new.delivery_status then
    insert into private.storefront_events (event_name, order_id)
    values ('order_delivered', new.id)
    on conflict do nothing;
  end if;

  if new.payment_status = 'paid'
    and old.payment_status is distinct from new.payment_status then
    insert into private.storefront_events (event_name, order_id)
    values ('order_paid', new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger orders_log_lifecycle_events
  after update of delivery_status, payment_status on public.orders
  for each row
  when (new.delivery_status = 'delivered' or new.payment_status = 'paid')
  execute function private.log_order_lifecycle_events();
revoke all on function private.log_order_lifecycle_events()
  from public, anon, authenticated;

create function public.track_storefront_event(
  p_event_name text,
  p_session_id uuid,
  p_product_id uuid default null,
  p_variant_id uuid default null,
  p_quantity integer default null,
  p_order_number text default null,
  p_page text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_metadata jsonb := '{}'::jsonb;
begin
  if p_session_id is null then
    raise exception using
      errcode = '22023',
      message = 'A browser session identifier is required.';
  end if;

  case p_event_name
    when 'page_view' then
      if p_page is null
        or p_page not in ('shop', 'checkout', 'confirmation')
        or p_product_id is not null
        or p_variant_id is not null
        or p_quantity is not null
        or p_order_number is not null then
        raise exception using
          errcode = '22023',
          message = 'Invalid page view event data.';
      end if;
      v_metadata := pg_catalog.jsonb_build_object('page', p_page);

    when 'product_view' then
      if p_page is not null
        or p_product_id is null
        or p_variant_id is not null
        or p_quantity is not null
        or p_order_number is not null
        or not exists (
          select 1
          from public.products as product
          where product.id = p_product_id
            and product.active
        ) then
        raise exception using
          errcode = '22023',
          message = 'Invalid product view event data.';
      end if;

    when 'product_variant_selected', 'add_to_cart' then
      if p_page is not null
        or p_product_id is null
        or p_variant_id is null
        or p_order_number is not null
        or (
          p_event_name = 'product_variant_selected'
          and p_quantity is not null
        )
        or (
          p_event_name = 'add_to_cart'
          and (p_quantity is null or p_quantity < 1 or p_quantity > 50)
        )
        or not exists (
          select 1
          from public.products as product
          join public.product_variants as variant
            on variant.product_id = product.id
          where product.id = p_product_id
            and variant.id = p_variant_id
            and product.active
            and variant.active
        ) then
        raise exception using
          errcode = '22023',
          message = 'Invalid product variant event data.';
      end if;

    when 'checkout_started' then
      if p_page is not null
        or p_product_id is not null
        or p_variant_id is not null
        or p_quantity is not null
        or p_order_number is not null then
        raise exception using
          errcode = '22023',
          message = 'Invalid checkout event data.';
      end if;

    when 'order_confirmed' then
      if p_page is not null
        or p_product_id is not null
        or p_variant_id is not null
        or p_quantity is not null
        or p_order_number is null
        or p_order_number !~ '^MNV-[0-9]+$' then
        raise exception using
          errcode = '22023',
          message = 'Invalid order confirmation event data.';
      end if;

      select order_record.id
      into v_order_id
      from public.orders as order_record
      where order_record.order_number = p_order_number;

      if v_order_id is null then
        raise exception using
          errcode = '22023',
          message = 'The order confirmation event does not match an order.';
      end if;

    else
      raise exception using
        errcode = '22023',
        message = 'This storefront event is not accepted from the browser.';
  end case;

  insert into private.storefront_events (
    event_name,
    session_id,
    order_id,
    product_id,
    variant_id,
    quantity,
    metadata
  )
  values (
    p_event_name,
    p_session_id,
    v_order_id,
    p_product_id,
    p_variant_id,
    p_quantity,
    v_metadata
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.track_storefront_event(
  text, uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
grant execute on function public.track_storefront_event(
  text, uuid, uuid, uuid, integer, text, text
) to anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'manvelle-storefront-event-retention';

select cron.schedule(
  'manvelle-storefront-event-retention',
  '0 3 * * *',
  $cron$
    delete from private.storefront_events
    where created_at < statement_timestamp() - interval '12 months'
  $cron$
);

commit;
