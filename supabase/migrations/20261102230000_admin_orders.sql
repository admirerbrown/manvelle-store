begin;

create table public.admins (
  email text primary key check (char_length(btrim(email)) > 3)
);

alter table public.orders
  add column if not exists notes text;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admins
    where lower(email) = lower((select auth.jwt() ->> 'email'))
  );
$$;

revoke all on table public.admins from public, anon, authenticated;
grant select, insert, update on table public.admins to service_role;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create policy admins_read_orders
  on public.orders for select to authenticated
  using (public.is_admin());

create policy admins_update_order_status
  on public.orders for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy admins_read_order_items
  on public.order_items for select to authenticated
  using (public.is_admin());

grant select on public.orders, public.order_items to authenticated;
grant update (order_status) on public.orders to authenticated;
revoke update on public.orders from authenticated;
grant update (order_status) on public.orders to authenticated;

create index if not exists admins_email_lower_idx on public.admins (lower(email));

commit;
