begin;

alter table public.product_variants
  add column sort_order integer not null default 0
  constraint product_variants_sort_order_nonnegative check (sort_order >= 0);

create index product_variants_product_active_order_idx
  on public.product_variants (product_id, active, sort_order, size);

commit;
