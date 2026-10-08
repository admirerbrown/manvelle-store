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

### Handoff / proposed next phase

The next proposed phase is **Secure order creation**: implement a narrowly scoped PostgreSQL function that accepts product/variant IDs and quantities plus customer/delivery input, validates availability and delivery zone, derives all authoritative prices and totals, creates snapshot rows, and returns only the newly created order confirmation data. Keep direct table writes and order reads denied. Before implementing inventory changes, ask the owner to choose whether stock is reduced at order submission or staff confirmation, or whether orders only check stock without reservation.

**Waiting for user approval before starting this phase.**

## Subsequent phase outline

Proceed one phase at a time, recording a milestone and updating this handoff after each approved phase:

1. Project foundation and database schema — complete
2. Row-level security and database access policies — complete
3. Secure, authoritative order-creation mechanism — next
4. Catalogue access and local fixtures
5. Cart and guest checkout
6. Order confirmation and WhatsApp handoff
7. Analytics foundation
8. Storefront UX, accessibility, SEO, and visual polish
9. Local end-to-end, backend, and security verification
10. Production configuration and deployment readiness
11. Production deployment and smoke testing, only after approval
