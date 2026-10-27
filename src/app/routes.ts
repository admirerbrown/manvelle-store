import { matchPath } from "react-router-dom";
import categoryData from "../../catalog/category.json";

// Every URL in the storefront is defined here, so links, redirects and the
// page-level logic in App.tsx all agree.
//
//   /                              home
//   /collections/pants             a category
//   /collections/pants/office      a subcategory
//   /products/cargo-pants          a product
//   /bag   /checkout   /order-confirmation

export const paths = {
  home: "/",
  collection: (categoryId: string) => `/collections/${categoryId}`,
  product: (slug: string) => `/products/${encodeURIComponent(slug)}`,
  bag: "/bag",
  checkout: "/checkout",
  confirmation: "/order-confirmation",
} as const;

export type AppRoute =
  | { name: "home" }
  | { name: "collection-index" }
  | { name: "collection"; categoryId: string }
  | { name: "product"; slug: string }
  | { name: "bag" }
  | { name: "checkout" }
  | { name: "confirmation" }
  | { name: "not-found" };

/** "pants", "pants/office", ... straight from catalog/category.json. */
const categoryLabels = new Map<string, string>();
for (const category of categoryData.categories) {
  categoryLabels.set(category.id, category.name);
  for (const subcategory of category.subcategories) {
    categoryLabels.set(
      `${category.id}/${subcategory.id}`,
      `${category.name} / ${subcategory.name}`,
    );
  }
}

export function getCategoryLabel(categoryId: string): string | null {
  return categoryLabels.get(categoryId) ?? null;
}

export function resolveRoute(pathname: string): AppRoute {
  if (matchPath({ path: "/", end: true }, pathname)) {
    return { name: "home" };
  }

  const product = matchPath("/products/:slug", pathname);
  if (product?.params.slug) {
    return { name: "product", slug: product.params.slug };
  }

  const collection = matchPath("/collections/*", pathname);
  if (collection) {
    const categoryId = (collection.params["*"] ?? "").replace(/\/+$/, "");
    if (categoryId === "") {
      return { name: "collection-index" };
    }
    return categoryLabels.has(categoryId)
      ? { name: "collection", categoryId }
      : { name: "not-found" };
  }

  if (matchPath("/bag", pathname)) return { name: "bag" };
  if (matchPath("/checkout", pathname)) return { name: "checkout" };
  if (matchPath("/order-confirmation", pathname)) return { name: "confirmation" };
  return { name: "not-found" };
}
