import type { Database } from "../../lib/supabase/database.types";
import { getSupabaseClient } from "../../lib/supabase/client";

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
const localCatalogAssets = import.meta.glob<string>(
  "/catalog/**/*.{jpeg,jpg,png,webp}",
  { eager: true, query: "?url", import: "default" },
);

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

  const imagesByProduct = new Map<string, CatalogueImage[]>();
  for (const image of imagesResult.data) {
    const images = imagesByProduct.get(image.product_id) ?? [];
    images.push({
      id: image.id,
      alt_text: image.alt_text,
      sortOrder: image.sort_order,
      url: getProductImageUrl(image.storage_path),
      srcSet: getProductImageSrcSet(image.storage_path),
      fallbackUrl: getLocalCatalogImageUrl(image.storage_path),
      colorName: getImageName(image.storage_path),
    });
    imagesByProduct.set(image.product_id, images);
  }

  return products.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? [],
    images: imagesByProduct.get(product.id) ?? [],
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

function getProductImageSrcSet(storagePath: string): string {
  if (storagePath.startsWith(localFixturePrefix)) {
    return getProductImageUrl(storagePath);
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

export function getLocalCatalogImageUrl(storagePath: string): string | null {
  const segments = storagePath.split("/");
  if (segments[0] !== "products") {
    return null;
  }

  if (segments.length >= 4) {
    const slug = segments.at(-2);
    const fileName = segments.at(-1);
    const categoryPath = segments.slice(1, -2);
    if (slug && fileName) {
      const categoryAsset = findLocalCatalogAsset(
        [...categoryPath, slug].join("/"),
        fileName,
      );
      if (categoryAsset) {
        return categoryAsset;
      }
    }
  }

  // Keep resolving older storage rows created before category folders were introduced.
  const legacyMatch = storagePath.match(/^products\/([^/]+)\/([^/]+)$/);
  if (!legacyMatch) {
    return null;
  }
  const legacySlug = legacyMatch[1] ?? "";
  const legacyFileName = legacyMatch[2] ?? "";
  const nestedLegacyAsset = findLocalCatalogAsset(legacySlug, legacyFileName);
  if (nestedLegacyAsset) {
    return nestedLegacyAsset;
  }
  const catalogFolder =
    legacySlug === "khakie-trousers"
      ? "khakie"
      : legacySlug === "beltless-material-trousers"
        ? "beltless-trouser"
        : legacySlug;
  return findLocalCatalogAsset(catalogFolder, legacyFileName);
}

// Local images live under nested folders (for example
// /catalog/pants/cargo-pants/cargo-tra2.jpeg), so match on the trailing
// "<folder>/<file>" instead of assuming a flat /catalog/<folder>/ layout.
function findLocalCatalogAsset(folder: string, fileName: string): string | null {
  const exact = localCatalogAssets[`/catalog/${folder}/${fileName}`];
  if (exact) {
    return exact;
  }
  const suffix = `/${folder}/${fileName}`;
  const key = Object.keys(localCatalogAssets).find((assetPath) =>
    assetPath.endsWith(suffix),
  );
  return key ? (localCatalogAssets[key] ?? null) : null;
}

export function getLocalProductImageUrl(slug: string): string | null {
  const assetPath = Object.keys(localCatalogAssets).find((path) =>
    path.includes(`/${slug}/`),
  );
  return assetPath ? (localCatalogAssets[assetPath] ?? null) : null;
}

function getImageName(storagePath: string): string {
  const fileName = storagePath.split("/").at(-1) ?? storagePath;
  const name = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return name.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
