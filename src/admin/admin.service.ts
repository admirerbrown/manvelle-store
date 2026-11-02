import { getAdminSupabaseClient } from "../lib/adminSupabase";
import type { Database } from "../lib/supabase/database.types";

export type AdminOrder = Database["public"]["Tables"]["orders"]["Row"];
export type AdminOrderItem =
  Database["public"]["Tables"]["order_items"]["Row"];
export type AdminOrderStatus = "pending" | "completed" | "cancelled";

export async function checkAdminAccess(): Promise<boolean> {
  const client = getAdminSupabaseClient();
  const { data: session } = await client.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await client.rpc("is_admin");
  if (error) throw error;
  return data === true;
}

export async function requestAdminCode(email: string): Promise<void> {
  const { error } = await getAdminSupabaseClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyAdminCode(
  email: string,
  token: string,
): Promise<void> {
  const { error } = await getAdminSupabaseClient().auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
  if (!(await checkAdminAccess())) {
    await getAdminSupabaseClient().auth.signOut();
    throw new Error("Not authorised.");
  }
}

export async function signOutAdmin(): Promise<void> {
  const { error } = await getAdminSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function listAdminOrders(
  start: string | null,
  end: string | null,
  status: AdminOrderStatus | "all",
): Promise<AdminOrder[]> {
  let query = getAdminSupabaseClient()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);
  if (status !== "all") query = query.eq("order_status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAdminOrder(id: string): Promise<{
  order: AdminOrder;
  items: AdminOrderItem[];
}> {
  const client = getAdminSupabaseClient();
  const [orderResult, itemResult] = await Promise.all([
    client.from("orders").select("*").eq("id", id).single(),
    client.from("order_items").select("*").eq("order_id", id),
  ]);
  if (orderResult.error) throw orderResult.error;
  if (itemResult.error) throw itemResult.error;
  return { order: orderResult.data, items: itemResult.data };
}

export async function updateAdminOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<void> {
  const { error } = await getAdminSupabaseClient()
    .from("orders")
    .update({ order_status: status })
    .eq("id", id);
  if (error) throw error;
}
