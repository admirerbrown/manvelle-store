import { getAdminSupabaseClient } from "../lib/adminSupabase";
import type { Database } from "../lib/supabase/database.types";
import {
  getLocalCatalogImages,
} from "../features/catalogue/catalog-images";
import { colourNameFromFile } from "../lib/catalog-folder";

export type AdminOrder = Database["public"]["Tables"]["orders"]["Row"];
export type AdminOrderItem =
  Database["public"]["Tables"]["order_items"]["Row"];
export type AdminOrderItemView = AdminOrderItem & {
  imageUrl: string | null;
  colorName: string | null;
};
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
  items: AdminOrderItemView[];
}> {
  const client = getAdminSupabaseClient();
  const [orderResult, itemResult] = await Promise.all([
    client.from("orders").select("*").eq("id", id).single(),
    client.from("order_items").select("*").eq("order_id", id),
  ]);
  if (orderResult.error) throw orderResult.error;
  if (itemResult.error) throw itemResult.error;

  const productIds = [
    ...new Set(
      itemResult.data
        .map((item) => item.product_id)
        .filter((productId): productId is string => productId !== null),
    ),
  ];
  const [productsResult, imagesResult] = await Promise.all([
    productIds.length > 0
      ? client.from("products").select("id,slug,category").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length > 0
      ? client
          .from("product_images")
          .select("product_id,storage_path")
          .in("product_id", productIds)
          .eq("active", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  const remoteImageByProduct = new Map<
    string,
    { url: string; colorName: string }
  >();
  for (const image of imagesResult.data) {
    if (!remoteImageByProduct.has(image.product_id)) {
      remoteImageByProduct.set(
        image.product_id,
        {
          url: client.storage
            .from("product-images")
            .getPublicUrl(image.storage_path).data.publicUrl,
          colorName: colourNameFromFile(image.storage_path),
        },
      );
    }
  }
  const productById = new Map(productsResult.data.map((product) => [product.id, product]));

  return {
    order: orderResult.data,
    items: itemResult.data.map((item) => {
      const product = item.product_id ? productById.get(item.product_id) : undefined;
      const remoteImages = item.product_id
        ? imagesResult.data
            .filter((image) => image.product_id === item.product_id)
            .map((image) => ({
              url: client.storage
                .from("product-images")
                .getPublicUrl(image.storage_path).data.publicUrl,
              colorName: colourNameFromFile(image.storage_path),
            }))
        : [];
      const remoteImage =
        remoteImages.find((image) => image.colorName === item.color_snapshot) ??
        (item.product_id ? remoteImageByProduct.get(item.product_id) : undefined);
      const localImage = product
        ? getLocalCatalogImages(product.slug, product.category).find(
            (image) => image.colorName === item.color_snapshot,
          ) ?? getLocalCatalogImages(product.slug, product.category)[0]
        : undefined;
      return {
        ...item,
        imageUrl: remoteImage?.url ?? localImage?.url ?? null,
        colorName:
          item.color_snapshot ??
          remoteImage?.colorName ??
          localImage?.colorName ??
          null,
      };
    }),
  };
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
