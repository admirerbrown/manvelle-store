# Manvelle Storefront

A local-first, mobile-first commerce storefront for Manvelle Menswear Ghana. The application is designed as a static React/Vite site backed by Supabase; customers can browse and place guest orders with cash on delivery.

## Project status

The repository foundation, database schema, restrictive RLS policies, and secure guest-order RPC are in place on `development`. Catalogue integration, storefront, checkout UI, analytics, and production setup remain. See [the project handoff](./docs/PROJECT-HANDOFF.md) for milestones and the current continuation point.

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

The example environment values are placeholders for local development. Start Supabase before using database-backed features. Never put a service-role key, database password, or other secret in a `VITE_` variable.

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
  lib/supabase/          Supabase client configuration
supabase/
  migrations/            Versioned PostgreSQL schema and policy changes
docs/
  PROJECT-HANDOFF.md     Milestones, decisions, and continuation notes
```

Database migrations are the source of truth for schema changes. Local seed fixtures will be added separately; use clearly synthetic data for tests and do not invent live Manvelle product information.

## Security and environment boundaries

- The browser is untrusted. Prices, totals, stock, order privacy, and order state must be enforced in PostgreSQL or a controlled database function.
- Anonymous and authenticated users can read only active catalogue items and delivery zones. Orders and order items have no direct public grants or policies.
- Default privileges and local Supabase API settings require explicit grants before newly created public-schema objects are exposed.
- Guest orders must use `public.create_guest_order`; it accepts an idempotency UUID, customer and delivery fields, and a JSON array of `{ "product_id", "variant_id", "quantity" }` items. Client-supplied prices and totals are rejected.
- The order RPC returns only a non-sensitive confirmation summary. It normalizes Ghanaian phone numbers, reads prices and delivery fees from the database, and reserves stock atomically. Cancellation restores stock once; failed-delivery restocking remains a staff action.
- Only the Supabase anon/publishable key may be used in the browser. Never use the service-role key in Vite configuration.
- Keep local and production Supabase projects separate. Production credentials are not used for ordinary local development.
- Do not deploy until local database, security, and end-to-end checks pass. After approval, tested work is promoted from `development` to `main`, the deployment branch.

## Specifications

The detailed requirements are in [`manvelle-spec1`](./manvelle-spec1) and [`mavelle-spec2`](./mavelle-spec2). These user-provided, untracked files are intentionally preserved.
