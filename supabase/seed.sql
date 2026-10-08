-- Synthetic local test fixtures only. Never use these as live Manvelle products,
-- delivery areas, prices, or customer data.

insert into public.products (
  id, name, slug, description, price, category, active, featured
) values
  (
    '00000000-0000-4000-8000-000000000001',
    'Synthetic Fixture: Test Tee',
    'synthetic-fixture-test-tee',
    'Local-only catalogue fixture. This is not a real Manvelle product.',
    123.45,
    'test-fixture',
    true,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'Synthetic Fixture: Test Jacket',
    'synthetic-fixture-test-jacket',
    'Local-only catalogue fixture. This is not a real Manvelle product.',
    234.56,
    'test-fixture',
    true,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'Synthetic Fixture: Inactive Product',
    'synthetic-fixture-inactive-product',
    'Local-only inactive fixture for catalogue visibility checks.',
    345.67,
    'test-fixture',
    false,
    false
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  price = excluded.price,
  category = excluded.category,
  active = excluded.active,
  featured = excluded.featured;

insert into public.product_variants (
  id, product_id, size, sku, stock_quantity, active
) values
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'S',
    'SYN-TEE-S',
    3,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    'M',
    'SYN-TEE-M',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000002',
    'M',
    'SYN-JKT-M',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000022',
    '00000000-0000-4000-8000-000000000002',
    'L',
    'SYN-JKT-L',
    5,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000031',
    '00000000-0000-4000-8000-000000000003',
    'L',
    'SYN-INACTIVE-L',
    2,
    true
  )
on conflict (id) do update set
  product_id = excluded.product_id,
  size = excluded.size,
  sku = excluded.sku,
  stock_quantity = excluded.stock_quantity,
  active = excluded.active;

insert into public.product_images (
  id, product_id, storage_path, alt_text, sort_order, active
) values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'local-fixtures/synthetic-test-tee.svg',
    'Synthetic test illustration of a tee; not a real product photo.',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000002',
    'local-fixtures/synthetic-test-jacket.svg',
    'Synthetic test illustration of a jacket; not a real product photo.',
    0,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000003',
    'local-fixtures/synthetic-inactive-product.svg',
    'Synthetic inactive test illustration; not a real product photo.',
    0,
    true
  )
on conflict (id) do update set
  product_id = excluded.product_id,
  storage_path = excluded.storage_path,
  alt_text = excluded.alt_text,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.delivery_zones (
  id, code, name, delivery_fee, active
) values (
  '00000000-0000-4000-8000-000000000201',
  'synthetic-test-zone',
  'Synthetic local test area (not a real delivery area)',
  12.34,
  true
)
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  delivery_fee = excluded.delivery_fee,
  active = excluded.active;
