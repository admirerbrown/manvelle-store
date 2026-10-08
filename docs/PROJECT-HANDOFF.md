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

### Handoff / proposed next phase

The next proposed phase is **Catalogue access and local fixtures**: add a typed frontend catalogue service, local synthetic products/variants and image fixtures for development, and connect reads to the active-only Supabase policies. Do not invent live Manvelle products or upload to production. Keep order creation out of the UI until the checkout phase.

**Waiting for user approval before starting this phase.**

## Subsequent phase outline

Proceed one phase at a time, recording a milestone and updating this handoff after each approved phase:

1. Project foundation and database schema — complete
2. Row-level security and database access policies — complete
3. Secure, authoritative order-creation mechanism — complete
4. Catalogue access and local fixtures — next
5. Cart and guest checkout
6. Order confirmation and WhatsApp handoff
7. Analytics foundation
8. Storefront UX, accessibility, SEO, and visual polish
9. Local end-to-end, backend, and security verification
10. Production configuration and deployment readiness
11. Production deployment and smoke testing, only after approval
