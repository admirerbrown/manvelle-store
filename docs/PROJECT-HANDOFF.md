# Project Milestones and Handoff

## Milestone 1 — Discovery and specification review

**Status:** Complete

**Branch:** `development`

### Repository state

- The tracked project currently contains only `README.md`.
- `manvelle-spec1` and `mavelle-spec2` are untracked specification documents. Preserve them as user-provided files.
- At discovery, no application source, package manifest, Supabase configuration, database migrations, tests, or agent guidance files were found.

### Requirements captured

- Build a mobile-first React/Vite storefront that can be deployed as a static site.
- Use Supabase for PostgreSQL, Storage, catalogue and order data; do not add a separate server or unnecessary services.
- Work locally first, keep local and production configuration separate, and never expose service-role credentials.
- Design the database and relationships before building the UI. Enforce prices, totals, stock, order creation, privacy, and state transitions at the database/backend boundary.
- Support guest checkout, Ghana Cedi pricing, cash on delivery, order confirmation, and post-order WhatsApp handoff.
- Use migrations and locally reproducible fixtures; test the full order flow and security before production setup or deployment.
- Work on `development`; only move tested work to `main`, the deployment branch, after the project is verified.

## Milestone 2 — Project foundation and initial database schema

**Status:** Complete

**Branch:** `development`

### Delivered

- Added the React/Vite/TypeScript foundation, npm scripts and lockfile, environment example, and a small modular source layout.
- Initialized the Supabase CLI configuration and added versioned PostgreSQL schema migration files.
- Added products, variants, product images, delivery zones, orders, and order items with historical item snapshots, explicit order/payment/delivery status types, constraints, indexes, generated order numbers, and timestamp triggers.
- Enabled RLS on every application table with no permissive policies. Access remains denied until the policies are implemented and verified in the next phase.
- Documented setup, local commands, security boundaries, and the branch/deployment workflow in the README.

### Verification

- `npm install` completed; the npm audit reported zero vulnerabilities.
- `npm run build` passed.
- `npm run dev` served the application successfully over local HTTP.
- The migration applied successfully to a temporary, isolated Supabase PostgreSQL container. A rollback-only smoke test verified generated order numbers, snapshot relationships, financial constraints, and enabled RLS on all six application tables.
- The temporary validation container was removed.

### Local environment note

An unrelated Supabase stack was already running on the default local ports (`54321`–`54327`). It was left untouched. This project is configured to use API/database ports `54421`/`54422` instead. The full application Supabase stack was not started; the schema was validated against an isolated temporary database.

## Milestone 3 — Row-level security and database access policies

**Status:** Complete

**Branch:** `development`

### Delivered

- Added explicit `SELECT` grants and RLS policies for active products, active variants and images belonging to active products, and active delivery zones.
- Revoked public, anonymous, and authenticated access to orders, order items, and the order-number sequence. No order policies exist; the later controlled order-creation function must be the only public order-creation path.
- Revoked public-schema `CREATE` access and hardened default privileges for future tables, sequences, and functions.
- Set the local Supabase API to require explicit table exposure instead of automatically exposing future tables.

### Verification

- Applied both migrations to an isolated Supabase PostgreSQL 17 container.
- As `anon`, confirmed only active catalogue and delivery-zone rows were visible; inactive rows and rows attached to inactive products were hidden.
- Confirmed `anon` cannot update catalogue data, read or insert orders/order items, use the order-number sequence, or read a newly created table without explicit grants.
- Confirmed all six application tables retain RLS. Test fixtures were rolled back, and the temporary container was removed.

## Milestone 4 — Secure guest order creation

**Status:** Complete

**Branch:** `development`

### Delivered

- Added `public.create_guest_order`, a `SECURITY DEFINER` RPC with a fixed empty search path. It accepts an idempotency UUID, customer/delivery details, and exact `{product_id, variant_id, quantity}` item objects; price/total fields and extra item fields are rejected.
- The database validates the Ghanaian phone format and normalizes it to `+233`, validates active delivery zones and product/variant relationships, reads current prices and delivery fees from PostgreSQL, calculates totals, and stores order-time snapshots.
- The RPC locks product and variant rows in stable order, validates stock, and reserves it atomically when the order is created. A transaction-scoped advisory lock makes retries with the same idempotency key return the original confirmation without creating another order or reserving stock twice.
- The RPC returns a public-safe confirmation summary without customer name, phone, address, or raw database ID. Direct order and order-item reads/writes remain denied.
- Added a cancellation trigger that restores reserved stock once. Failed-delivery restocking remains a staff action, as selected by the owner.

### Verification

- Applied all three migrations to a fresh isolated Supabase PostgreSQL 17 database.
- As `anon`, created orders and verified server-calculated item totals, delivery fee, order number, COD status, and phone normalization.
- Replayed the same idempotency key and confirmed the original order was returned without a second stock deduction.
- Rejected invalid phones, zero quantity, mismatched/inactive product variants, inactive delivery zones, injected price/total fields, and insufficient stock without creating orders or changing inventory.
- Confirmed cancellation restores stock once and concurrent requests for the final unit result in exactly one successful order.
- The temporary database was removed after testing.

### Handoff

Catalogue work was approved and completed in Phase 5; see the Milestone 5 record below. Order creation remains out of the UI until the checkout phase.

## Subsequent phase outline

Proceed one phase at a time, recording a milestone and updating this handoff after each approved phase:

1. Specification review and project discovery — complete
2. Project foundation and database schema — complete
3. Row-level security and database access policies — complete
4. Secure, authoritative order-creation mechanism — complete
5. Catalogue access and local fixtures — complete
6. Cart and guest checkout
7. Order confirmation and WhatsApp handoff
8. Analytics foundation
9. Storefront UX, accessibility, SEO, and visual polish
10. Local end-to-end, backend, and security verification
11. Production configuration and deployment readiness
12. Production deployment and smoke testing, only after approval

## Milestone 5 — Catalogue access and local fixtures

**Status:** Complete

**Branch:** `development`

### Delivered

- Added Supabase database typings and a typed catalogue service for active products, product sizes and stock, product images, and active delivery zones.
- Added explicit query ordering and filters in addition to relying on RLS. Catalogue queries return `null` for an unknown or inactive product slug, and surface database errors rather than returning success-shaped empty data.
- Local image fixture paths resolve to illustrations under `supabase/seed_assets/`; non-fixture paths resolve through the `product-images` Supabase Storage bucket. No product photography is represented as real.
- Added repeatable local-only seed rows for two active synthetic products, one inactive product, multiple sizes and stock states (including zero stock), three labeled SVG illustrations, and one clearly synthetic delivery zone. The fixture prices and fee are not real business values, and no real customer information is included.
- Updated the README with the data boundary, local fixture use, and future Storage setup note.

### Verification

- `npm run build` passed, including TypeScript project checks.
- Editor diagnostics reported no errors in the new database typings or catalogue service.
- `git diff --check` passed.
- The Vite development server returned the local synthetic SVG with HTTP 200 and `image/svg+xml`.
- All three migrations and `supabase/seed.sql` applied successfully to an isolated PostgreSQL 17 instance.
- Under the `anon` role, only active rows were visible: 2 products, 4 variants, 2 images, and 1 delivery zone. The inactive fixture and its child rows remained hidden.
- Starting the full Supabase stack was attempted, but its image downloads were too slow to complete. No Manvelle stack containers were left running, and the existing unrelated Supabase stack was not touched.

### Handoff / next phase

The next proposed phase is **Cart and guest checkout**. It may add client-side cart state and checkout form UI, but the database `create_guest_order` RPC remains authoritative for current prices, delivery fees, availability, inventory reservation, and order creation. Continue using the synthetic local fixtures only. No production credentials, real product data, Storage uploads, or deployment are in scope.

**Waiting for user approval before starting the next phase.**
