import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const admins = ["admirerbrown@gmail.com"];
const projectRoot = process.cwd();

async function loadEnvironment() {
  const envPath = path.join(projectRoot, ".env.local");
  let contents;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

await loadEnvironment();

const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  "http://127.0.0.1:54421";
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const emails = admins
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (emails.length === 0) {
  console.error("Add at least one email to the admins list in scripts/add-admin.mjs.");
  process.exit(1);
}

const invalidEmails = emails.filter(
  (email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
);
if (invalidEmails.length > 0) {
  console.error(`Invalid admin email(s): ${invalidEmails.join(", ")}`);
  process.exit(1);
}

if (!secretKey) {
  console.error(
    "Add SUPABASE_SECRET_KEY to .env.local. " +
      "The publishable key cannot create Auth users.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: users, error: listError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const email of emails) {
  let user = users.users.find(
    (candidate) => candidate.email?.toLowerCase() === email,
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created Auth user: ${email}`);
  } else {
    if (!user.email_confirmed_at) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true },
      );
      if (error) throw error;
      user = data.user;
    }
    console.log(`Auth user already exists: ${email}`);
  }

  const { error: adminError } = await supabase
    .from("admins")
    .upsert({ email }, { onConflict: "email" });
  if (adminError) throw adminError;

  console.log(`Granted admin access to ${user.email ?? email}`);
}
