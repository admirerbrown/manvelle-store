import type { Database } from "../../lib/supabase/database.types";
import { getSupabaseClient } from "../../lib/supabase/client";
import { colourNameFromFile } from "../../lib/catalog-folder";
import { getLocalCatalogImages } from "./catalog-images";

export { getLocalProductImageUrl } from "./catalog-images";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow =
  Database["public"]["Tables"]["product_variants"]["Row"];
type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];

export type CatalogueVariant = Pick<
  ProductVariantRow,
  "id" | "size" | "sku" | "stock_quantity"
>;

export type ProductAvailability = ProductRow["availability"];

export type CatalogueImage = Pick<ProductImageRow, "id" | "alt_text"> & {
  url: string;
  srcSet: string;
  fallbackUrl: string | null;
  sortOrder: number;
  colorName: string;
};

export type CatalogueProduct = Pick<
  ProductRow,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "key_features"
  | "price"
  | "category"
  | "availability"
  | "featured"
> & {
  variants: CatalogueVariant[];
  images: CatalogueImage[];
};

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
    .select(
      "id,name,slug,description,key_features,price,category,availability,featured",
    )
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
      .select("id,product_id,size,sort_order,sku,stock_quantity")
      .in("product_id", productIds)
      .eq("active", true)
      .order("sort_order", { ascending: true })
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

  // Remote (database) image rows grouped by product. They are only used for a
  // product that has no folder under /catalog (e.g. the local-fixtures seed).
  const remoteImagesByProduct = new Map<string, CatalogueImage[]>();
  for (const image of imagesResult.data) {
    const images = remoteImagesByProduct.get(image.product_id) ?? [];
    images.push({
      id: image.id,
      alt_text: image.alt_text,
      sortOrder: image.sort_order,
      url: getRemoteProductImageUrl(image.storage_path),
      srcSet: getRemoteProductImageSrcSet(image.storage_path),
      fallbackUrl: null,
      colorName: colourNameFromFile(image.storage_path),
    });
    remoteImagesByProduct.set(image.product_id, images);
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? [],
    images: getProductImages(
      product,
      remoteImagesByProduct.get(product.id) ?? [],
    ),
  }));
}

/**
 * The catalogue folder is the source of truth for a product's photos:
 *   catalog/<category>/<subcategory>/<product-folder>/<colour>.jpeg
 * Every file in that folder becomes one colour option for that product, and no
 * file from another product's folder can appear here. Database image rows are
 * not consulted for products that have a folder, so stale, incomplete or
 * mis-mapped rows cannot hide a colour or break an image.
 */
function getProductImages(
  product: Pick<CatalogueProduct, "name" | "slug" | "category">,
  remoteImages: CatalogueImage[],
): CatalogueImage[] {
  const localImages = getLocalCatalogImages(product.slug, product.category);
  if (localImages.length === 0) {
    return remoteImages;
  }
  return localImages.map((image, index) => ({
    id: `local:${image.id}`,
    alt_text: `${product.name} - ${image.colorName.toLowerCase()}`,
    sortOrder: index * 10,
    url: image.url,
    srcSet: image.url,
    fallbackUrl: image.url,
    colorName: image.colorName,
  }));
}

export function isVariantInStock(
  product: Pick<CatalogueProduct, "availability">,
  variant: Pick<CatalogueVariant, "stock_quantity">,
): boolean {
  return (
    product.availability !== "out-of-stock" &&
    (variant.stock_quantity === null || variant.stock_quantity > 0)
  );
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

function getRemoteProductImageUrl(storagePath: string): string {
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

function getRemoteProductImageSrcSet(storagePath: string): string {
  if (storagePath.startsWith(localFixturePrefix)) {
    return getRemoteProductImageUrl(storagePath);
  }

  const storage = getSupabaseClient().storage.from(productImageBucket);
  return [
    [480, 72],
    [768, 76],
    [1200, 80],
  ]
    .map(([width, quality]) => {
      const url = storage.getPublicUrl(storagePath, {
        transform: { width, quality },
      }).data.publicUrl;
      return `${url} ${width}w`;
    })
    .join(", ");
}
