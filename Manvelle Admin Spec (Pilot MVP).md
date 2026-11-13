# Manvelle Admin Spec (Pilot MVP)

Prepared for an AI coding agent. Build exactly what is written here. Do not add features that are not listed. Where this spec says "inspect the repo", read the existing code first and adapt to what is already working.

## 1. Context

- Project: Manvelle Menswear Ghana storefront (React + Vite, Supabase).
- Supabase runs **locally first**. Do not touch Supabase cloud. Cloud migration happens later, by the owner.
- The catalog (products, colours, images, prices) stays exactly as it works today. **Do not build product management.**
- Git is in use. Deliver changes as files that can be copied over the existing folder. Do not modify git config, and do not reformat unrelated files.
- Currency: Ghana cedis (GH₵). Timezone: Africa/Accra (UTC, no DST).

## 2. Goal

Give shop admins a private dashboard to see who ordered what, review daily orders, mark orders pending, completed or cancelled, and send the customer a receipt on WhatsApp. That is all.

## 3. In scope

1. Admin login with a one-time email code, every session.
2. Orders list and order detail.
3. Status changes: pending, completed, cancelled.
4. Daily view with count and total.
5. WhatsApp receipt via a prefilled `wa.me` link (admin taps send).
6. Order creation from the storefront checkout (only if it does not already work, see section 7).

## 4. Out of scope (do not build)

Product or category editing, stock tracking, discounts, analytics beyond the daily count and total, multiple admin roles, customer accounts, automatic WhatsApp sending (Business API), SMS or email notifications to customers, order editing, refunds, payment integration changes.

## 5. Data model

Put this in a new Supabase migration file. Adapt names only if they collide with existing tables.

```sql
create table public.admins (
  email text primary key
);

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null
    default ('MV-' || nextval('public.order_number_seq')),
  customer_name text not null,
  phone text not null,            -- stored normalised, e.g. +233241234567
  address text,
  notes text,
  total numeric(10,2) not null check (total >= 0),
  status text not null default 'pending'
    check (status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,     -- snapshot at purchase time
  colour text,
  size text,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index order_items_order_id_idx on public.order_items (order_id);
```

Items are snapshots (name, colour, size, price copied at purchase time) so later catalog or price changes never alter past orders.

## 6. Security (RLS)

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

alter table public.admins enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- admins table: no policies for anon or authenticated (only is_admin() reads it)

create policy "admins read orders" on public.orders
  for select to authenticated using (public.is_admin());

create policy "admins update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins read order items" on public.order_items
  for select to authenticated using (public.is_admin());

-- Admins may change status only, nothing else on orders
revoke update on public.orders from authenticated;
grant update (status) on public.orders to authenticated;

-- No insert, delete policies for anyone. Orders are created only through create_order().
revoke all on public.orders, public.order_items from anon;
```

Rules:

- Anonymous visitors can never read, update or delete orders.
- Customers create orders only through the `create_order` function below.
- The route guard in the frontend is for user experience only. RLS is the real protection.

## 7. Order creation (storefront checkout)

**First, inspect the repo.** If checkout already creates orders in a working way, keep that flow and only change it to write into the tables above through `create_order`. If there is no order creation yet, build the minimum: a checkout form that collects name, phone, address (optional notes), and calls the function.

```sql
create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_notes text,
  p_items jsonb   -- [{product_name, colour, size, quantity, unit_price}, ...]
)
returns table (order_id uuid, order_number text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(10,2);
  v_id uuid;
  v_number text;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Order has no items';
  end if;

  select coalesce(sum((i->>'quantity')::int * (i->>'unit_price')::numeric), 0)
    into v_total
  from jsonb_array_elements(p_items) i;

  insert into orders (customer_name, phone, address, notes, total)
  values (p_customer_name, p_phone, p_address, p_notes, v_total)
  returning id, orders.order_number into v_id, v_number;

  insert into order_items (order_id, product_name, colour, size, quantity, unit_price)
  select v_id, i->>'product_name', i->>'colour', i->>'size',
         (i->>'quantity')::int, (i->>'unit_price')::numeric
  from jsonb_array_elements(p_items) i;

  return query select v_id, v_number, v_total;
end;
$$;

grant execute on function public.create_order(text,text,text,text,jsonb) to anon, authenticated;
```

Notes for the agent:

- The **total is always computed in the function**, never accepted from the browser.
- **Prices:** if product prices live in a database table, look them up server-side inside the function by product and ignore any client-sent price. If prices exist only in frontend code or files (current catalog setup), the function accepts client-sent unit prices for the pilot. Flag this clearly in your summary as a known limitation to fix when products move into the database.
- Validate inputs: name and phone required, quantity between 1 and 50, items array max 50 lines.
- Phone normalisation (do it in the frontend before calling, and re-check in the function): strip spaces, dashes and brackets; if it starts with `0`, replace the leading `0` with `+233`; if it starts with `233`, prefix `+`; reject anything that is not `+233` followed by 9 digits.
- After success, show the customer their order number.

## 8. Admin login (one-time code, every session)

### Setup

- Disable public signups in Supabase auth config (`enable_signup = false` locally).
- Create each admin as an auth user manually (Supabase dashboard or `supabase auth` admin API in a seed script), and insert the same email into `public.admins`. Provide a seed SQL/script with a placeholder email that the owner replaces.
- Email template for the magic link/OTP must include the code (`{{ .Token }}`), not only a link. Update the local `supabase/templates` and config accordingly.
- Locally, test emails appear in the Supabase Inbucket (Mailpit) UI. Document the URL in the README.
- **Before the pilot goes to cloud:** a custom SMTP provider (for example Resend or Brevo) must be configured, because Supabase's default sender is heavily rate limited. Add this to the README as a pre-launch checklist item. Do not implement it now.
- Set a short JWT expiry (for example 4 hours, `jwt_expiry = 14400` locally).

### Client behaviour

- Create a **dedicated admin Supabase client** with its own `storageKey` and `auth.storage` set to `window.sessionStorage`, so the session is not kept after the browser closes and a fresh code is needed next time.
- Step 1: admin enters email, app calls `signInWithOtp({ email, options: { shouldCreateUser: false } })`. Always show the same neutral message ("If this email is registered, a code has been sent") whether or not the email exists.
- Step 2: admin enters the 6-digit code, app calls `verifyOtp({ email, token, type: 'email' })`.
- Step 3: after verifying, call `is_admin()` (rpc). If false, sign out and show "Not authorised". If true, go to `/admin/orders`.
- Add a resend button with a 60 second cooldown, and a clear error for a wrong or expired code.
- Logout button in the admin header.

### Routes

| Path | Behaviour |
| --- | --- |
| `/admin` | Redirects to `/admin/orders` if admin session, else `/admin/login` |
| `/admin/login` | Email then code form |
| `/admin/orders` | Orders dashboard (guarded) |
| `/admin/orders/:id` | Order detail (guarded) |

- The route guard checks session and `is_admin()`. Unauthenticated users are redirected to `/admin/login`.
- **Do not link to `/admin` anywhere on the public storefront** (no nav, footer or sitemap entry). Add `noindex` meta on admin pages.
- Admin pages use a separate layout from the storefront (no storefront header or footer).

## 9. Orders dashboard

### List page (`/admin/orders`)

- Date picker, **default today** (Africa/Accra). Show orders created on the selected date. Include a "All dates" option.
- Summary bar for the selected date: number of orders, total value (**excluding cancelled**), and counts by status.
- Status filter: All, Pending, Completed, Cancelled.
- Table or card rows (must be usable on a phone): order number, time, customer name, phone, item count, total, status badge.
- Newest first. Simple pagination or a cap of 100 rows per query is enough.
- Include a refresh button. Realtime updates are not required.

### Detail page (`/admin/orders/:id`)

- Order number, created date and time, status.
- Customer name, phone, address, notes.
- Items table: product name, colour, size, quantity, unit price, line total. Order total at the bottom.
- Status actions: buttons for Pending, Completed, Cancelled (current status highlighted). Changing status updates immediately and shows success or error feedback. Cancelling asks for a confirmation dialog.
- "Send receipt on WhatsApp" button (section 10).
- Back to list link.

## 10. WhatsApp receipt (lightweight)

The button opens WhatsApp with a prefilled message to the customer. The admin taps send. There is no API integration and no server involvement.

Link format:

```
https://wa.me/<phone digits only, no plus>?text=<URL-encoded message>
```

Build the digits by removing the leading `+` from the stored phone (for example `233241234567`). Open in a new tab. Use `encodeURIComponent` on the message.

Message template:

```
Hello {customer_name}, thank you for ordering from Manvelle Menswear Ghana.

Order {order_number}
Date: {dd Mon yyyy}

Items:
{qty} x {product_name} ({colour}, {size}) - GH₵{line_total}
(one line per item)

Total: GH₵{total}
Status: {status}

We will contact you about delivery. Thank you.
```

Rules: format money with two decimals and thousands separators. Omit colour or size in the line if empty. The receipt can be sent at any status; it shows the current status.

## 11. Suggested file structure

Adapt to the repo's existing conventions (inspect first).

```
supabase/migrations/<timestamp>_admin_orders.sql
supabase/seed or scripts/seed-admin.*
src/lib/adminSupabase.(ts|js)        dedicated admin client
src/lib/phone.(ts|js)                normalisation helper
src/lib/receipt.(ts|js)              message builder + wa.me link
src/admin/AdminLayout
src/admin/AdminGuard
src/admin/LoginPage
src/admin/OrdersPage
src/admin/OrderDetailPage
```

## 12. Acceptance criteria

1. With signups disabled, an email not in `admins` cannot get into `/admin/orders`, and receives no usable access.
2. A registered admin gets a code by email (visible in the local Inbucket), enters it, and reaches the orders page.
3. Closing the browser and reopening requires a new code.
4. Querying `orders` or `order_items` with the anon key returns nothing and fails to write.
5. A normal admin cannot change any order column except `status`.
6. A customer checkout creates one order with its items and returns an order number. The total in the database equals the sum of the item lines.
7. Phone numbers are stored in `+233XXXXXXXXX` format and invalid ones are rejected.
8. The orders page defaults to today, shows the correct count and total (cancelled excluded), and filters by date and status.
9. Status changes persist and the summary updates.
10. The WhatsApp button opens the correct number with the receipt text filled in, rendered correctly with the cedi sign and line breaks.
11. The admin pages are usable on a phone-width screen.
12. Nothing on the public storefront links to `/admin`.

## 13. Build order

1. Migration (tables, `is_admin`, RLS, `create_order`) and admin seed script.
2. Order creation wired into checkout, with phone normalisation.
3. Admin client, login flow and route guard.
4. Orders list with date filter and summary.
5. Order detail with status changes.
6. WhatsApp receipt button.
7. README: local setup, Inbucket URL, how to add an admin, and the pre-launch checklist (custom SMTP, cloud migration steps, price verification limitation).

## 14. Report back

When finished, the agent must summarise: files added or changed, how to run and test locally, any assumption made about the existing checkout or catalog, and any acceptance criterion that is not met.
