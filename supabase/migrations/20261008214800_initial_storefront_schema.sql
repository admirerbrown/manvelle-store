begin;

-- Monetary values are stored in Ghana Cedis (GHS).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.order_status as enum (
  'pending',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'failed_delivery'
);

create type public.payment_method as enum ('cash_on_delivery');

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded'
);

create type public.delivery_status as enum (
  'pending',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'failed_delivery'
);

create sequence public.order_number_seq start with 1000 increment by 1 no cycle;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  category text,
  active boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (char_length(btrim(size)) > 0),
  sku text unique,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_size_key unique (product_id, size)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null check (char_length(btrim(storage_path)) > 0),
  alt_text text not null default '',
  sort_order integer not null default 0,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_images_product_path_key unique (product_id, storage_path)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) > 0),
  delivery_fee numeric(10, 2) not null check (delivery_fee >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('MNV-' || nextval('public.order_number_seq'::regclass)::text),
  customer_name text not null
    check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null
    check (char_length(btrim(customer_phone)) between 7 and 20),
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_zone_name_snapshot text not null
    check (char_length(btrim(delivery_zone_name_snapshot)) > 0),
  delivery_address text not null
    check (char_length(btrim(delivery_address)) between 3 and 500),
  delivery_fee numeric(10, 2) not null check (delivery_fee >= 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  total numeric(10, 2) not null check (total = subtotal + delivery_fee),
  payment_method public.payment_method not null default 'cash_on_delivery',
  payment_status public.payment_status not null default 'pending',
  order_status public.order_status not null default 'pending',
  delivery_status public.delivery_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name_snapshot text not null
    check (char_length(btrim(product_name_snapshot)) > 0),
  size_snapshot text not null
    check (char_length(btrim(size_snapshot)) > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_subtotal numeric(10, 2) not null
    check (line_subtotal = unit_price * quantity),
  created_at timestamptz not null default now()
);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function private.set_updated_at();

create trigger delivery_zones_set_updated_at
  before update on public.delivery_zones
  for each row execute function private.set_updated_at();

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function private.set_updated_at();

create index products_active_featured_idx
  on public.products (active, featured);

create index product_variants_product_active_idx
  on public.product_variants (product_id, active);

create index product_images_product_active_sort_idx
  on public.product_images (product_id, active, sort_order);

create index delivery_zones_active_name_idx
  on public.delivery_zones (active, name);

create index orders_order_status_created_at_idx
  on public.orders (order_status, created_at desc);

create index orders_payment_status_created_at_idx
  on public.orders (payment_status, created_at desc);

create index orders_delivery_status_created_at_idx
  on public.orders (delivery_status, created_at desc);

create index order_items_order_id_idx
  on public.order_items (order_id);

create index order_items_product_id_idx
  on public.order_items (product_id);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

comment on table public.delivery_zones is
  'Delivery areas and authoritative fees; populate only with confirmed business rates.';
comment on table public.orders is
  'Guest orders. Customer data and order access must remain protected by explicit policies.';
comment on table public.order_items is
  'Order-time product, size, and price snapshots preserve historical order details.';

commit;
