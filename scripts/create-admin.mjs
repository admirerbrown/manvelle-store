// Creates (or reuses) a Supabase Auth user and registers the email as an admin.
//
// Usage (bash):
//   SUPABASE_URL=http://127.0.0.1:54421 \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`> \
//   node scripts/create-admin.mjs admin@example.com
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="http://127.0.0.1:54421"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key>"
//   node scripts/create-admin.mjs admin@example.com
//
// The service role key bypasses all security. Never put it in a VITE_ variable,
// never import it in src/, and never commit it.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: node scripts/create-admin.mjs <admin-email>");
  process.exit(1);
}
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: createError } = await supabase.auth.admin.createUser({
  email,
  email_confirm: true,
});

if (createError) {
  if (createError.code === "email_exists") {
    console.log(`Auth user already exists for ${email}, continuing.`);
  } else {
    console.error("Could not create the auth user:", createError.message);
    process.exit(1);
  }
} else {
  console.log(`Created auth user for ${email}.`);
}

const { error: adminError } = await supabase.from("admins").upsert({ email });
if (adminError) {
  console.error("Could not add the email to public.admins:", adminError.message);
  process.exit(1);
}

console.log(`${email} is now an admin. They can request a sign-in code at /admin/login.`);
