import type { Database } from "../../lib/supabase/database.types";
import { getSupabaseClient } from "../../lib/supabase/client";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];
type DeliveryZoneRow = Database["public"]["Tables"]["delivery_zones"]["Row"];

export type CatalogueVariant = Pick<
  ProductVariantRow,
  "id" | "size" | "sku" | "stock_quantity"
>;

export type CatalogueImage = Pick<ProductImageRow, "id" | "alt_text"> & {
  url: string;
  sortOrder: number;
};

export type CatalogueProduct = Pick<
  ProductRow,
  "id" | "name" | "slug" | "description" | "price" | "category" | "featured"
> & {
  variants: CatalogueVariant[];
  images: CatalogueImage[];
};

export type CatalogueDeliveryZone = Pick<
  DeliveryZoneRow,
  "id" | "code" | "name" | "delivery_fee"
>;

const productImageBucket = "product-images";
const localFixturePrefix = "local-fixtures/";

type ProductFilters = {
  featuredOnly?: boolean;
  slug?: string;
};

async function loadProducts({
  featuredOnly = false,
  slug,
}: ProductFilters = {}): Promise<CatalogueProduct[]> {
  const client = getSupabaseClient();
  let productsQuery = client
    .from("products")
    .select("id,name,slug,description,price,category,featured")
    .eq("active", true)
    .order("featured", { ascending: false })
    .order("name", { ascending: true });

  if (featuredOnly) {
    productsQuery = productsQuery.eq("featured", true);
  }
  if (slug !== undefined) {
    productsQuery = productsQuery.eq("slug", slug);
  }

  const { data: products, error: productsError } = await productsQuery;
  if (productsError) {
    throw new Error("Could not load the product catalogue.", {
      cause: productsError,
    });
  }
  if (products.length === 0) {
    return [];
  }

  const productIds = products.map((product) => product.id);
  const [variantsResult, imagesResult] = await Promise.all([
    client
      .from("product_variants")
      .select("id,product_id,size,sku,stock_quantity")
      .in("product_id", productIds)
      .eq("active", true)
      .order("size", { ascending: true }),
    client
      .from("product_images")
      .select("id,product_id,storage_path,alt_text,sort_order")
      .in("product_id", productIds)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (variantsResult.error) {
    throw new Error("Could not load product sizes and availability.", {
      cause: variantsResult.error,
    });
  }
  if (imagesResult.error) {
    throw new Error("Could not load product images.", {
      cause: imagesResult.error,
    });
  }

  const variantsByProduct = new Map<string, CatalogueVariant[]>();
  for (const variant of variantsResult.data) {
    const variants = variantsByProduct.get(variant.product_id) ?? [];
    variants.push({
      id: variant.id,
      size: variant.size,
      sku: variant.sku,
      stock_quantity: variant.stock_quantity,
    });
    variantsByProduct.set(variant.product_id, variants);
  }

  const imagesByProduct = new Map<string, CatalogueImage[]>();
  for (const image of imagesResult.data) {
    const images = imagesByProduct.get(image.product_id) ?? [];
    images.push({
      id: image.id,
      alt_text: image.alt_text,
      sortOrder: image.sort_order,
      url: getProductImageUrl(image.storage_path),
    });
    imagesByProduct.set(image.product_id, images);
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? [],
    images: imagesByProduct.get(product.id) ?? [],
  }));
}

export function getCatalogueProducts(
  options: Pick<ProductFilters, "featuredOnly"> = {},
): Promise<CatalogueProduct[]> {
  return loadProducts(options);
}

export async function getCatalogueProductBySlug(
  slug: string,
): Promise<CatalogueProduct | null> {
  const products = await loadProducts({ slug });
  return products[0] ?? null;
}

export async function getCatalogueDeliveryZones(): Promise<
  CatalogueDeliveryZone[]
> {
  const { data, error } = await getSupabaseClient()
    .from("delivery_zones")
    .select("id,code,name,delivery_fee")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Could not load delivery areas.", { cause: error });
  }

  return data;
}

function getProductImageUrl(storagePath: string): string {
  if (storagePath.startsWith(localFixturePrefix)) {
    const fixturePath = storagePath.slice(localFixturePrefix.length);
    const segments = fixturePath.split("/");
    if (
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    ) {
      throw new Error(`Invalid local product image path: ${storagePath}`);
    }

    return `/supabase/seed_assets/${segments.map(encodeURIComponent).join("/")}`;
  }

  return getSupabaseClient()
    .storage.from(productImageBucket)
    .getPublicUrl(storagePath).data.publicUrl;
}
