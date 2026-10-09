# Manvelle Storefront

A local-first, mobile-first commerce storefront for Manvelle Menswear Ghana. The application is designed as a static React/Vite site backed by Supabase; customers can browse and place guest orders with cash on delivery.

## Project status

The repository foundation, database schema, restrictive RLS policies, secure guest-order RPC, typed catalogue reads, cart, guest checkout, detailed order confirmation, click-to-WhatsApp handoff, and privacy-safe analytics foundation are in place on `development`. The local seed is explicitly synthetic and is not real Manvelle product, pricing, delivery, or customer data. Visual polish, full local end-to-end verification, and production setup remain. See [the project handoff](./docs/PROJECT-HANDOFF.md) for milestones and the current continuation point, and the [backend capabilities and catalogue guide](./docs/BACKEND-CAPABILITIES.md) for current backend features and product setup.

## Technology

- React and TypeScript with Vite
- Supabase PostgreSQL and Storage
- Supabase migrations for reproducible database changes
- Static frontend deployment, after local verification

## Local setup

Requirements: Node.js 22 or later, npm, and Docker for the local Supabase stack.
The local Supabase API and database use ports `54421` and `54422` to avoid colliding with other local Supabase projects.

```bash
npm install
cp .env.example .env.local
npm run db:start
npm run dev
```

The Supabase example values are placeholders for local development. `VITE_WHATSAPP_NUMBER` is a public contact destination in international format without `+`; it is included in the site link, not treated as a secret. Start Supabase before using database-backed features. Never put a service-role key, database password, or other secret in a `VITE_` variable.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the static production build in `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm run db:start` | Start the local Supabase stack |
| `npm run db:stop` | Stop the local Supabase stack |
| `npm run db:status` | Show local Supabase service status |
| `npm run db:reset` | Recreate the local database and apply migrations |

## Repository layout

```text
src/
  app/                   Application entry and top-level UI
  features/catalogue/    Typed catalogue and delivery-area reads
  features/cart/         In-memory cart and availability checks
  features/checkout/     Guest checkout and authoritative RPC client
  lib/supabase/          Supabase client configuration
supabase/
  migrations/            Versioned PostgreSQL schema and policy changes
  seed.sql               Local-only synthetic fixtures
  seed_assets/           Local-only synthetic product illustrations
docs/
  PROJECT-HANDOFF.md     Milestones, decisions, and continuation notes
```

Database migrations are the source of truth for schema changes. `npm run db:reset` loads clearly labeled synthetic products, sizes, stock, product illustrations, and one synthetic delivery area for local development. These fixtures are not real Manvelle products, prices, stock levels, delivery areas, or customer information and must not be used to seed production.

### Managing product sizes

Product sizes are data-driven: each product card renders the active variant rows configured for that product, rather than a fixed frontend size list. Configure at least four active rows in `public.product_variants` for each product. The storefront omits a style card until it has four active sizes, so incomplete product setup cannot expose a card with fewer choices. Sizes can differ by product category—for example, a shirt might use `L`, `XL`, `2XL`, and `3XL`, while trousers might use numeric waist sizes such as `32`, `34`, `36`, and `38`. These are examples only; admins should enter Manvelle's actual ranges and stock.

For now, admins manage product and variant rows in the Supabase Dashboard using authorized project access; there is no storefront admin interface. Set `sort_order` in ascending steps (for example, `10`, `20`, `30`, `40`) to control the displayed size order. Keep a product inactive until its size rows are ready. Set each variant's stock accurately; a zero-stock size remains visible but cannot be added to the bag. The public storefront can read active catalogue rows but cannot write them. Never expose a service-role key in the browser.

The catalogue service reads only active products, variants, images, and delivery zones; database RLS independently enforces the same visibility boundary. Image paths beginning with `local-fixtures/` resolve to `supabase/seed_assets/` in the Vite development server. Other image paths resolve through the public `product-images` Supabase Storage bucket.

### Managing the product spreadsheet

Edit [catalog/products.csv](./catalog/products.csv) in a spreadsheet editor. Keep its columns as `name`, `description`, `key_features`, `available_sizes`, `availability`, and `price`. Separate sizes with `|`; availability is `in-stock` or `out-of-stock`. Product slugs are generated from names. Put product photos in a folder named after that slug under `catalog/`; existing folder-name exceptions are handled for the initial products. The spreadsheet and image folders are the source for product details, size options, product availability, and storefront images.
Image file names identify color choices on each product page. Customers choose
a color image and size before adding that combination to their bag; the
WhatsApp order message includes the chosen image's public URL.

Run `npm run catalog:validate` to check the spreadsheet and its image mappings without changing Supabase. To import or update products, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in an ignored `.env.catalog.local` file (copy [.env.catalog.example](./.env.catalog.example) as a starting point), then run `npm run catalog:sync`. The importer upserts products, sizes, and image mappings, uploads the images to the public Storage bucket, deactivates sizes and images removed from the spreadsheet/folder, and does not delete old image files. Product availability is binary; catalog-managed size rows do not claim a stock quantity. Do not put the service-role key in any `VITE_` variable or frontend file.

### Storefront analytics and privacy

The storefront records the specified funnel events: page and product views, size selection, add-to-bag, checkout start, order creation/confirmation, delivery, and payment. Browser events go through a validated RPC; order creation, delivery, and payment events are generated by database triggers. The event table is private and cannot be queried by browser roles. No pixel, advertising vendor, or customer contact/address data is collected. Browser sessions use a random tab-scoped identifier, and page views store only an approved page label.

Analytics events are automatically purged daily at 03:00 UTC when older than 12 months using PostgreSQL `pg_cron`. The cron extension and retention job are provisioned by the analytics migration. Analytics reporting is an authorized database-side task; no admin dashboard is included.

## Security and environment boundaries

- The browser is untrusted. Prices, totals, stock, order privacy, and order state must be enforced in PostgreSQL or a controlled database function.
- Cash on Delivery is available for Accra addresses only. Checkout requires an
  Accra yes/no response; non-Accra customers must acknowledge the WhatsApp
  payment-before-delivery arrangement, which is validated and recorded by the
  order RPC.
- Anonymous and authenticated users can read only active catalogue items and delivery zones. Orders and order items have no direct public grants or policies.
- Default privileges and local Supabase API settings require explicit grants before newly created public-schema objects are exposed.
- Guest orders must use `public.create_guest_order`; it accepts an idempotency UUID, customer and delivery fields, and a JSON array of `{ "product_id", "variant_id", "quantity" }` items. Client-supplied prices and totals are rejected.
- The order RPC returns only a non-sensitive confirmation summary. It normalizes Ghanaian phone numbers, calculates product prices, and reserves stock atomically. Delivery area is entered at checkout; the delivery fee is confirmed on WhatsApp and is not included in the displayed subtotal. Cancellation restores stock once; failed-delivery restocking remains a staff action.
- WhatsApp opens only after the order RPC confirms creation. The prefilled message includes the public order number, selected product sizes and image-name colors, public product-image links, subtotal, and delivery area. It does not include the customer's name, phone number, or street address, and the customer must explicitly send the message.
- Only the Supabase anon/publishable key may be used in the browser. Never use the service-role key in Vite configuration.
- Keep local and production Supabase projects separate. Production credentials are not used for ordinary local development.
- Do not deploy until local database, security, and end-to-end checks pass. After approval, tested work is promoted from `development` to `main`, the deployment branch.

## Specifications

The detailed requirements are in [`manvelle-spec1`](./manvelle-spec1) and [`mavelle-spec2`](./mavelle-spec2). These user-provided, untracked files are intentionally preserved.
