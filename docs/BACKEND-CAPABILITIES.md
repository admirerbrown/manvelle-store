# Backend Capabilities and Catalogue Guide

This document describes the backend currently implemented for the Manvelle
storefront, how to add catalogue products using authorized Supabase access, and
which capabilities are not yet implemented.

## Current backend capabilities

The backend is built on Supabase and PostgreSQL. Database migrations define the
schema, access policies, order processing, and analytics. The browser uses only
the Supabase anon/publishable key; privileged database access belongs to
authorized staff and backend functions.

### Product catalogue

The current schema supports:

- **Products:** name, unique URL slug, description, key features, GHS price,
  category text, in-stock/out-of-stock availability, active/hidden status, and
  featured status.
- **Size variants:** product association, size label, optional SKU, stock
  quantity when tracked (or no size-level count), active status, and display
  order.
- **Product images:** storage path, alt text, display order, and active status.
- **Delivery areas:** customers enter their Accra neighbourhood at checkout;
  staff do not maintain a required list of selectable areas.

The public storefront can read active products, their active variants and
images. Row-level security (RLS) independently enforces this visibility
boundary. Public browser roles cannot edit catalogue data. Product image file
names are displayed as color choices on the product page.

Every visible product card must have at least four active size variants. The
storefront omits products with fewer than four active variants. Spreadsheet
products use product-level availability: an out-of-stock product remains
visible, but none of its sizes can be added to the bag. Existing products may
continue to use size-level quantities.

### Guest orders and inventory

- Guest checkout supports **Cash on Delivery (COD)** for addresses in Accra.
  Customers outside Accra must accept arranging payment before delivery on
  WhatsApp.
- The database validates customer name, Ghanaian phone number, delivery
  area and address, product/variant relationship, quantity, and availability.
  Delivery is currently offered across Accra; excluded neighbourhoods can be
  added to server-side validation later.
- The database calculates product prices and subtotal. The delivery fee is
  recorded as a zero placeholder and is explicitly confirmed with the customer
  on WhatsApp; checkout and confirmation do not present that placeholder as a
  free delivery or final total.
- Tracked size quantities are reserved as part of successful order creation.
  Spreadsheet-managed products use a manual in-stock/out-of-stock flag and do
  not claim per-size quantities.
- Retrying an order request with the same idempotency key returns the existing
  order rather than creating a duplicate.
- Customers receive a limited confirmation summary. Public browser roles cannot
  directly read or modify orders or order items.
- The WhatsApp handoff includes each selected product, size, chosen image-name
  color, and a public product-image URL so the customer can send the images to
  the store admin. The customer must explicitly send the prefilled message.
- Order items retain product name, size, unit price, quantity, and subtotal
  snapshots so later catalogue changes do not alter historical order details.
- Cancelling an order restores reserved inventory once. Failed-delivery
  restocking remains a staff action.

The schema includes order states `pending`, `confirmed`, `out_for_delivery`,
`delivered`, `completed`, `cancelled`, and `failed_delivery`, with separate
payment and delivery statuses. These status fields do not provide an admin
interface or a customer account system.

### Analytics and privacy

The backend records these funnel events:

- `page_view`
- `product_view`
- `product_variant_selected`
- `add_to_cart`
- `checkout_started`
- `order_created`
- `order_confirmed`
- `order_delivered`
- `order_paid`

Browser events pass through a validated RPC. Order creation, delivery, and
payment events are emitted by database triggers rather than trusted to the
browser. Analytics rows are stored in a private table that browser roles cannot
read. The implementation does not record customer names, phone numbers,
addresses, or raw URLs. A daily PostgreSQL `pg_cron` job deletes events older
than 12 months.

## Managing the catalogue spreadsheet

Edit [`../catalog/products.csv`](../catalog/products.csv) in a spreadsheet
editor. Its columns are `name`, `description`, `key_features`,
`available_sizes`, `availability`, `price`, and `category`. Assign each
product a valid category key from `../catalog/category.json`; nested
categories use `parent/child` (for example, `pants/office`). Separate multiple sizes with
`|`; availability must be `in-stock` or `out-of-stock`; price is in GHS.
Slugs are generated from product names and are used to match image folders.
Each product needs at least four unique sizes. Add image files to a folder
under `catalog/<category>/<product-slug>/`, where the category path mirrors the
category key in the spreadsheet. The initial `khakie-trousers` and
`beltless-material-trousers` products use the `khakie` and `beltless-trouser`
folder aliases respectively.

Run `npm run catalog:validate` to check rows, sizes, availability, and image
folder mappings without making database changes. For an authorized import,
copy [`.env.catalog.example`](../.env.catalog.example) to
`.env.catalog.local`, set the Supabase URL and service-role key, and run
`npm run catalog:sync`. The ignored local env file keeps credentials outside
frontend configuration. The importer upserts products, active sizes, image
rows, and uploads images to the public `product-images` bucket. Removed sizes
and images are deactivated, not deleted. Re-running the command is safe.

For spreadsheet-managed products, size-level `stock_quantity` is `NULL` and
the product's `availability` field controls whether every size may be ordered.
Turning a product out of stock prevents new orders while keeping its card
visible. Existing products may retain tracked size-level quantities. Changes
take effect after syncing the spreadsheet and refreshing the storefront.

The repository's [synthetic seed](../supabase/seed.sql) demonstrates the
expected row relationships and is for local development only. Its names,
prices, delivery area, and stock are not real business data.

## Products, categories, and collections

Products have a `category` text field populated from the spreadsheet. The
catalogue sync validates the key against `catalog/category.json` before saving,
and the storefront provides parent and subcategory browsing/filtering from the
same taxonomy. Shoes is available as a normal category and can receive products
through the spreadsheet.

There is **no separate collections feature** yet: the database has no
collection table or product-to-collection membership, and the storefront has
no collection pages. Groups such as “New Arrivals” or “Workwear” would need a
future schema and storefront implementation; they cannot be fully set up by
editing product rows alone.

## Not implemented yet

- Storefront admin interface; product and availability changes are made in the
  spreadsheet and imported by an authorized operator.
- Separate collection records, product memberships, and collection pages.
- Production Storage bucket setup and real image-upload workflow.
- Customer accounts or customer-facing order history.
- Payment gateway integration; COD is the current supported payment method.
- Analytics reporting dashboard.
- Full local end-to-end verification, production preparation, and deployment.

## Database source files

- [Initial schema](../supabase/migrations/20261008214800_initial_storefront_schema.sql)
- [Catalogue access policies](../supabase/migrations/20261008214900_catalogue_rls_policies.sql)
- [Guest order creation](../supabase/migrations/20261008215000_secure_guest_order_creation.sql)
- [Variant display order](../supabase/migrations/20261008215200_product_variant_sort_order.sql)
- [Analytics and retention](../supabase/migrations/20261008215300_storefront_analytics.sql)
- [Spreadsheet catalogue support](../supabase/migrations/20261009100000_spreadsheet_catalogue.sql)
- [Accra checkout and WhatsApp delivery confirmation](../supabase/migrations/20261009110000_accra_checkout.sql)
- [Project handoff and milestones](./PROJECT-HANDOFF.md)

The backend has been validated with isolated database tests and the storefront
build. Full end-to-end verification against the running local Supabase stack,
production configuration, and deployment are still outstanding. Use the
current implementation for local testing and feedback; do not treat it as
production-ready until those remaining checks and approvals are complete.
