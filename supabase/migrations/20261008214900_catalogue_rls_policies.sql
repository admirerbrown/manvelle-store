begin;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

revoke all privileges on table
  public.products,
  public.product_variants,
  public.product_images,
  public.delivery_zones
from public, anon, authenticated;

grant select on table
  public.products,
  public.product_variants,
  public.product_images,
  public.delivery_zones
to anon, authenticated;

revoke all privileges on table public.orders, public.order_items
from public, anon, authenticated;

revoke all privileges on sequence public.order_number_seq
from public, anon, authenticated;

create policy products_read_active
  on public.products
  for select
  to anon, authenticated
  using (active);

create policy product_variants_read_active_for_active_products
  on public.product_variants
  for select
  to anon, authenticated
  using (
    active
    and exists (
      select 1
      from public.products as product
      where product.id = product_variants.product_id
        and product.active
    )
  );

create policy product_images_read_active_for_active_products
  on public.product_images
  for select
  to anon, authenticated
  using (
    active
    and exists (
      select 1
      from public.products as product
      where product.id = product_images.product_id
        and product.active
    )
  );

create policy delivery_zones_read_active
  on public.delivery_zones
  for select
  to anon, authenticated
  using (active);

comment on table public.orders is
  'No direct API policies are granted. Use the controlled order-creation function for guest checkout.';

commit;
