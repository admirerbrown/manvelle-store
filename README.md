# Manvelle Storefront

A local-first, mobile-first commerce storefront for Manvelle Menswear Ghana. The application is designed as a static React/Vite site backed by Supabase; customers can browse and place guest orders with cash on delivery.

## Project status

The repository foundation, database schema, restrictive RLS policies, secure guest-order RPC, typed catalogue reads, cart, guest checkout, detailed order confirmation, click-to-WhatsApp handoff, and privacy-safe analytics foundation are in place on `development`. The local seed is explicitly synthetic and is not real Manvelle product, pricing, delivery, or customer data. Visual polish, full local end-to-end verification, and production setup remain. See [the project handoff](./docs/PROJECT-HANDOFF.md) for milestones and the current continuation point.

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

The catalogue service reads only active products, variants, images, and delivery zones; database RLS independently enforces the same visibility boundary. Image paths beginning with `local-fixtures/` resolve to `supabase/seed_assets/` in the Vite development server. Other image paths resolve through the public `product-images` Supabase Storage bucket; production bucket setup and real product uploads are deferred until the approved production-preparation phase. The browser uses only the anon/publishable key.

### Storefront analytics and privacy

The storefront records the specified funnel events: page and product views, size selection, add-to-bag, checkout start, order creation/confirmation, delivery, and payment. Browser events go through a validated RPC; order creation, delivery, and payment events are generated by database triggers. The event table is private and cannot be queried by browser roles. No pixel, advertising vendor, or customer contact/address data is collected. Browser sessions use a random tab-scoped identifier, and page views store only an approved page label.

Analytics events are automatically purged daily at 03:00 UTC when older than 12 months using PostgreSQL `pg_cron`. The cron extension and retention job are provisioned by the analytics migration. Analytics reporting is an authorized database-side task; no admin dashboard is included.

## Security and environment boundaries

- The browser is untrusted. Prices, totals, stock, order privacy, and order state must be enforced in PostgreSQL or a controlled database function.
- Anonymous and authenticated users can read only active catalogue items and delivery zones. Orders and order items have no direct public grants or policies.
- Default privileges and local Supabase API settings require explicit grants before newly created public-schema objects are exposed.
- Guest orders must use `public.create_guest_order`; it accepts an idempotency UUID, customer and delivery fields, and a JSON array of `{ "product_id", "variant_id", "quantity" }` items. Client-supplied prices and totals are rejected.
- The order RPC returns only a non-sensitive confirmation summary. It normalizes Ghanaian phone numbers, reads prices and delivery fees from the database, and reserves stock atomically. Cancellation restores stock once; failed-delivery restocking remains a staff action.
- WhatsApp opens only after the order RPC confirms creation. The prefilled message includes the public order number only; it does not include the customer's name, phone number, or street address, and the customer must explicitly send the message.
- Only the Supabase anon/publishable key may be used in the browser. Never use the service-role key in Vite configuration.
- Keep local and production Supabase projects separate. Production credentials are not used for ordinary local development.
- Do not deploy until local database, security, and end-to-end checks pass. After approval, tested work is promoted from `development` to `main`, the deployment branch.

## Specifications

The detailed requirements are in [`manvelle-spec1`](./manvelle-spec1) and [`mavelle-spec2`](./mavelle-spec2). These user-provided, untracked files are intentionally preserved.
