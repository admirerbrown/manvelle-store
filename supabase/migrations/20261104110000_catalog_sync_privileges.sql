begin;

-- The catalogue importer uses service_role outside the browser. RLS bypass does
-- not replace table privileges, so grant the operations required for sync
-- explicitly after the public catalogue privileges are restricted.
grant usage on schema public to service_role;
grant select, insert, update on table
  public.products,
  public.product_variants,
  public.product_images
to service_role;

commit;
