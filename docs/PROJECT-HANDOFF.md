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

### Handoff / proposed next phase

The next proposed phase is **Row-level security and database access policies**: allow anonymous reads only for active catalogue and delivery-zone data, keep customer/order data private, and disallow public writes until the secure order RPC is implemented. Use this project's non-default ports and do not reset or modify the unrelated running Supabase stack.

**Waiting for user approval before starting this phase.**

## Subsequent phase outline

Proceed one phase at a time, recording a milestone and updating this handoff after each approved phase:

1. Project foundation and database schema — complete
2. Row-level security and database access policies — next
3. Secure, authoritative order-creation mechanism
4. Catalogue access and local fixtures
5. Cart and guest checkout
6. Order confirmation and WhatsApp handoff
7. Analytics foundation
8. Storefront UX, accessibility, SEO, and visual polish
9. Local end-to-end, backend, and security verification
10. Production configuration and deployment readiness
11. Production deployment and smoke testing, only after approval
