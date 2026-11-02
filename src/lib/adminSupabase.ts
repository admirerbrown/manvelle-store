import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";

let client: SupabaseClient<Database> | undefined;

export function getAdminSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = import.meta.env;
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured for admin access.");
  }
  client = createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: {
      storageKey: "manvelle.admin.auth",
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
