# Manvelle Storefront

A local-first, mobile-first commerce storefront for Manvelle Menswear Ghana. The application is designed as a static React/Vite site backed by Supabase; customers can browse and place guest orders with cash on delivery.

## Project status

The storefront, database schema, restrictive RLS policies, secure guest-order RPC, typed catalogue reads, category navigation, cart, guest checkout, detailed order confirmation, click-to-WhatsApp handoff, and privacy-safe analytics foundation are in place on `development`. The local seed is explicitly synthetic and is not real Manvelle product, pricing, delivery, or customer data. Full local end-to-end verification and production setup remain. See [the project handoff](./docs/PROJECT-HANDOFF.md) for milestones and the current continuation point, and the [backend capabilities and catalogue guide](./docs/BACKEND-CAPABILITIES.md) for current backend features and product setup.

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
| `./check-build.sh` | Verify `.env.production`, confirm the hosted catalogue has an active product, validate catalog files, and build the storefront |
| `./check-build.sh --preview` | Run the same checks, then serve the production build locally |
| `npm run preview` | Preview the built site locally |
| `npm run typecheck` | Run the TypeScript project checks |
| `npm run catalog:validate` | Validate product data, categories, sizes, and image folders without database changes |
| `npm run sync-catalog` | Import the spreadsheet and product images into the local Supabase database |
| `npm run sync-catalog -- --cloud` | Import the spreadsheet and product images into the hosted project in `.env.cloud` |
| `npm run catalog:sync` | Legacy alias for local catalog import |
| `npm run db:start` | Start the local Supabase stack |
| `npm run db:stop` | Stop the local Supabase stack |
| `npm run db:status` | Show local Supabase service status |
| `npm run db:reset` | Recreate the local database and apply migrations |

## Production setup and deployment

After local database, security, and end-to-end checks pass, promote the tested
code from `development` to `main`. The hosted database and static storefront
are deployed separately:

1. **Set up Supabase and sync the catalog.** Copy `.env.cloud.example` to the
   ignored `.env.cloud` and fill in its required values. After `npm install`,
   log in with `./node_modules/.bin/supabase login`, then run
   `./deploy-cloud.sh` from the repository root. Review the project-ref
   confirmation before continuing. The script uses a global Supabase CLI if
   available, otherwise the project-local CLI. It links the project, pushes
   migrations, syncs products and images, and configures admin access.
   Supabase CLI v3 also asks whether to apply the auth configuration. The
   script does not deploy the frontend or configure your SMTP provider/DNS.
2. **Configure the production frontend.** Create the ignored `.env.production`
   file with the hosted project URL and its anon/publishable API key:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-key
   VITE_GTM_ID=GTM-WHSN3754
   ```

   Use the anon/publishable key only. Never put a service-role key or database
   password in `.env.production`, a `VITE_` variable, or the frontend bundle.
3. **Check and build.** Run `./check-build.sh`. It checks that the hosted API
   responds with at least one active product, validates the local catalog
   files, builds the site, and checks the generated bundle. To inspect the
   production build locally, run `./check-build.sh --preview`.
4. **Deploy the frontend manually.** Upload the generated `dist/` directory to
   your static hosting provider. Configure an SPA fallback so requests for
   storefront routes serve `index.html`; see the host-specific note below.

The repository does not currently configure a frontend hosting provider or
automated frontend deployment. Keep `.env.cloud` and `.env.production`
uncommitted.

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
catalog/
  category.json          Store category and subcategory definitions
  products.csv           Product data, including assigned category keys
  category/product folders  Product images matched by category path and slug
docs/
  PROJECT-HANDOFF.md     Milestones, decisions, and continuation notes
```

Database migrations are the source of truth for schema changes. `npm run db:reset` loads clearly labeled synthetic products, sizes, stock, product illustrations, and one synthetic delivery area for local development. These fixtures are not real Manvelle products, prices, stock levels, delivery areas, or customer information and must not be used to seed production.

### Managing product sizes

Product sizes are data-driven: each product card renders the active variant rows configured for that product, rather than a fixed frontend size list. Configure at least four active rows in `public.product_variants` for each product. The storefront omits a style card until it has four active sizes, so incomplete product setup cannot expose a card with fewer choices. Sizes can differ by product category—for example, a shirt might use `L`, `XL`, `2XL`, and `3XL`, while trousers might use numeric waist sizes such as `32`, `34`, `36`, and `38`. These are examples only; admins should enter Manvelle's actual ranges and stock.

For now, admins manage product and variant rows in the Supabase Dashboard using authorized project access. Order operations are available at `/admin` and use a separate email OTP session; admin pages do not render the public storefront shell. Set `sort_order` in ascending steps (for example, `10`, `20`, `30`, `40`) to control the displayed size order. Keep a product inactive until its size rows are ready. Set each variant's stock accurately; a zero-stock size remains visible but cannot be added to the bag. The public storefront can read active catalogue rows but cannot write them. Never expose a service-role key in the browser.

### Local admin setup

The admin dashboard is intended for a controlled pilot. Start Supabase, then use the helper script to create or reuse an Auth user and grant that email admin access:

```bash
npm run add-admin
```

Add or remove test addresses in the `admins` list at the top of `scripts/add-admin.mjs`, then run the command again. Blank entries are ignored. The script reads `.env.local` and uses `VITE_SUPABASE_URL` for the local API URL. Add the `sb_secret_...` value from `npm run db:status` as `SUPABASE_SECRET_KEY`; the `sb_publishable_...` key cannot create Auth users. Never put the secret key in a `VITE_` variable or commit it. The seed file remains available for database resets, but it does not create Auth users.

Use [http://127.0.0.1:54424](http://127.0.0.1:54424) to receive local OTP emails through Supabase's email testing UI. Open `/admin/login`, request a code, then copy the six-digit `{{ .Token }}` value from the captured email. The local Auth session lasts four hours. In a hosted project, configure custom SMTP, apply the migrations, add only approved admin emails to `public.admins`, and verify the OTP template and RLS policies before inviting staff.

The catalogue service reads only active products, variants, images, and delivery zones; database RLS independently enforces the same visibility boundary. Image paths beginning with `local-fixtures/` resolve to `supabase/seed_assets/` in the Vite development server. Other image paths resolve through the public `product-images` Supabase Storage bucket.

### Storefront catalogue experience

The main navigation includes a category menu with hover and keyboard-focus
dropdowns for every category and subcategory defined in
`catalog/category.json`. Selecting a category opens its full filtered catalogue.
The home page presents Trending items, New arrivals, and a default category
section. Trending uses products marked `featured`; New arrivals currently uses
the first eligible products returned by the catalogue. Both sections preserve
the standard product cards and display them in horizontal carousels. The
default category shows the first few products, and its View more action opens
the full category listing.

### Managing the product spreadsheet

Edit [catalog/products.csv](./catalog/products.csv) in a spreadsheet editor. Keep its columns as `name`, `description`, `key_features`, `available_sizes`, `availability`, `price`, and `category`. Assign each product a valid category key from [catalog/category.json](./catalog/category.json), using `parent/child` for subcategories such as `pants/office`. Separate sizes with `|`; availability is `in-stock` or `out-of-stock`. Product slugs are generated from names. Put product photos in `catalog/<category>/<product-slug>/`, for example `catalog/pants/casual/cargo-pants/`; the folder may also be a shorter name made of the same words as the slug (for example `khakie` for Khakie Trousers or `beltless-trouser` for Beltless-Material Trousers). Every file in the folder becomes one colour option for that product; see [CATALOG_IMAGE_DATABASE_FIX.md](./CATALOG_IMAGE_DATABASE_FIX.md). The spreadsheet and image folders are the source for product details, size options, product availability, and storefront images. A sync also deactivates database products whose slugs are no longer in the spreadsheet, so removed products do not remain visible.
Image file names identify color choices on each product page. Customers choose
a color image and size before adding that combination to their bag; the
WhatsApp order message includes the chosen image's public URL.

Run `npm run catalog:validate` to check the spreadsheet and its image mappings without changing Supabase. To import or update products locally, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in an ignored `.env.catalog.local` file (copy [.env.catalog.example](./.env.catalog.example) as a starting point), then run `npm run sync-catalog` (or the existing `npm run catalog:sync` alias). To import into the hosted project configured in `.env.cloud`, run `npm run sync-catalog -- --cloud`; the `--` forwards the cloud option to the script. It uses `SUPABASE_PROJECT_REF` to select the project and fetches its service-role key through your authenticated Supabase CLI session. Alternatively, set `SUPABASE_SERVICE_ROLE_KEY` in `.env.cloud` to a server-side `service_role` or `sb_secret` key, never the anon/publishable key. The importer upserts products, sizes, and image mappings, uploads the images to the public Storage bucket, deactivates sizes and images removed from the spreadsheet/folder, and does not delete old image files. Product availability is binary; catalog-managed size rows do not claim a stock quantity. Never put the service-role key in a `VITE_` variable, frontend file, or source control.

### Storefront analytics and privacy

Marketing and storefront analytics are collected without requiring a shopper
preference banner. The app loads the `GTM-WHSN3754` container and pushes
`page_view`, `view_item`, `add_to_cart`, `begin_checkout`, and
`order_placed` events to its data layer regardless of consent state. The
production build can override the public container ID with `VITE_GTM_ID`.

Configure these tags and triggers in that GTM container:

1. Add the GA4 Google tag using the store's GA4 Measurement ID. Disable its
   automatic page-view on load, require `analytics_storage` consent, and create
   GA4 event tags triggered by the matching custom events. Map `order_placed`
   to GA4's recommended `purchase` event, including the provided ecommerce
   object (`transaction_id`, `currency`, `value`, and `items`).
2. Add the Meta Pixel base tag with the store's Pixel ID, requiring
   `ad_storage` consent. Trigger its `PageView`, `ViewContent`, `AddToCart`, and
   `InitiateCheckout` events from `page_view`, `view_item`, `add_to_cart`, and
   `begin_checkout`. Do not send a browser Pixel `Purchase`; the server sends
   that conversion when an admin completes the order.
3. Use GTM Preview and Meta Events Manager to verify those tags. Add the same
   Meta test event code to the GTM Pixel tag while testing, then remove it
   before production tracking.

The existing first-party funnel event table remains private and browser roles
cannot query it. Browser events are recorded as part of the storefront
analytics pipeline without requiring shopper consent; order
creation/delivery/payment lifecycle records remain generated by database
triggers. Browser sessions use a random tab-scoped identifier, and page views
store only an approved page label.

Analytics events are automatically purged daily at 03:00 UTC when older than
12 months using PostgreSQL `pg_cron`. The cron extension and retention job are
provisioned by the analytics migration. Analytics reporting is an authorized
database-side task; no admin dashboard is included.

### Meta server-side Purchase setup

The latest migration stores checkout attribution in the unexposed
`private.order_attribution` table. `_fbp` and `_fbc` are captured only after
marketing consent; the page path, user agent, and consent decision are stored
with the order. The Edge Function refuses to send Purchase events when consent
was not granted. Its stable `order_<order-id>` event ID, a database claim, and
`orders.meta_purchase_sent_at` protect against duplicate delivery.

Before marking any production order Completed:

1. Deploy migrations and link the Supabase CLI to the target project.
2. In Meta Events Manager, create a Pixel access token and copy the Pixel ID.
   Generate a random webhook secret (for example, `openssl rand -hex 32`).
3. Set the function secrets. Use a currently supported Meta Graph API version.
   Set `META_TEST_EVENT_CODE` while verifying; remove it afterward.

   ```sh
   supabase secrets set \
     META_PIXEL_ID='<pixel-id>' \
     META_ACCESS_TOKEN='<pixel-access-token>' \
     META_GRAPH_API_VERSION='vXX.X' \
     META_WEBHOOK_SECRET='<random-webhook-secret>' \
     META_TEST_EVENT_CODE='<test-event-code>'
   supabase functions deploy meta-purchase
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are read only inside the
   Edge Function runtime. Never add Meta or service-role credentials to
   frontend environment variables or source control.
4. In the Supabase SQL Editor, store the function endpoint and the **same**
   webhook secret in Vault. Replace the project ref and secret placeholders;
   do not commit this SQL with real values.

   ```sql
   select vault.create_secret(
     'https://<project-ref>.supabase.co/functions/v1/meta-purchase',
     'meta_purchase_function_url'
   );
   select vault.create_secret(
     '<same-random-webhook-secret>',
     'meta_purchase_hook_secret'
   );
   ```

5. In GTM Preview, allow optional consent and verify the GA4 and non-Purchase
   Pixel events. Place a test order with consent, set the order to Completed,
   and confirm the Purchase in Meta Events Manager's Test Events view. Confirm
   `meta_purchase_sent_at` is populated. Then remove `META_TEST_EVENT_CODE`
   from Supabase secrets and the test code from GTM before using live orders.

The database invokes the function only on a transition to Completed. If Meta
rejects an event, the function logs the failure and releases the claim; retry
by moving the order out of Completed and marking it Completed again, or by
invoking the function with that order ID. Meta receives the same event ID on
every attempt, so its event deduplication remains stable.

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

## Routes

All URLs are defined in `src/app/routes.ts`.

| URL | Page |
| --- | --- |
| `/` | Home (hero, trending, new arrivals) |
| `/collections/<category>` | Category, e.g. `/collections/pants` |
| `/collections/<category>/<subcategory>` | Subcategory, e.g. `/collections/pants/office` |
| `/products/<slug>` | Product page, e.g. `/products/cargo-pants` |
| `/bag`, `/checkout`, `/order-confirmation` | Bag, checkout, confirmation |

Category ids come from `catalog/category.json`. Because these are real URLs, the production host
must serve `index.html` for any path (an SPA fallback). `npm run dev` and `npm run preview` already do;
on Netlify add `/* /index.html 200` to `public/_redirects`, on Vercel add a rewrite to `/index.html`.
