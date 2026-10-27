import type { To } from "react-router-dom";
import categoryData from "../../../catalog/category.json";
import { paths } from "../../app/routes";
import { getCategoryImages } from "../catalogue/catalog-images";
import type { CatalogueProduct } from "../catalogue/catalogue.service";

export function categoryContainsProduct(
  categoryId: string,
  productCategory: string | null,
) {
  return (
    productCategory === categoryId ||
    productCategory?.startsWith(`${categoryId}/`) === true
  );
}

export type HeroImage = { src: string; alt: string };

export type HeroSlide = {
  id: string;
  eyebrow: string;
  headline: string;
  text: string | null;
  ctaLabel: string;
  ctaTo: To;
  images: HeroImage[];
};

export type LiveSubcategory = {
  id: string;
  name: string;
  path: string;
  styleCount: number;
};

export type LiveCategory = {
  id: string;
  name: string;
  styleCount: number;
  subcategories: LiveSubcategory[];
  coverUrl: string | null;
  products: CatalogueProduct[];
};

// Optional hand-written hero copy per category id. Categories without an entry
// get a generic line, so a new category works without touching this file.
const categoryCopy: Record<string, { headline: string; text: string }> = {
  "mens-underwear": {
    headline: "Boxers and singlets for every day.",
    text: "Pick your fit and your colour.",
  },
  pants: {
    headline: "Trousers and shorts for every day.",
    text: "Office, casual and cargo, in the colours you like.",
  },
};

function getCopy(categoryId: string, name: string) {
  return (
    categoryCopy[categoryId] ?? {
      headline: `${name} for every day.`,
      text: "Pick your style and your colour.",
    }
  );
}

function productPhotos(products: CatalogueProduct[], limit: number): HeroImage[] {
  return [...products]
    .sort((first, second) => Number(second.featured) - Number(first.featured))
    .filter((product) => product.images[0])
    .slice(0, limit)
    .map((product) => ({
      src: product.images[0]?.url ?? "",
      alt: product.name,
    }));
}

/**
 * Hero photo(s) for a category: catalog/<category>/hero.* (or carousel*.*) if the
 * folder has one, otherwise the first photos of the category's own products.
 */
function heroImages(
  path: string,
  name: string,
  products: CatalogueProduct[],
): HeroImage[] {
  const banner = getCategoryImages(path, ["hero", "carousel"])[0];
  return banner ? [{ src: banner, alt: name }] : productPhotos(products, 2);
}

/** Top-level categories that currently have at least one product to show. */
export function getLiveCategories(products: CatalogueProduct[]): LiveCategory[] {
  return categoryData.categories
    .map((category) => {
      const inCategory = products.filter((product) =>
        categoryContainsProduct(category.id, product.category),
      );
      return {
        id: category.id,
        name: category.name,
        styleCount: inCategory.length,
        products: inCategory,
        coverUrl:
          getCategoryImages(category.id, ["cover"])[0] ??
          productPhotos(inCategory, 1)[0]?.src ??
          null,
        subcategories: category.subcategories
          .map((subcategory) => {
            const path = `${category.id}/${subcategory.id}`;
            return {
              id: subcategory.id,
              name: subcategory.name,
              path,
              styleCount: inCategory.filter((product) =>
                categoryContainsProduct(path, product.category),
              ).length,
            };
          })
          .filter((subcategory) => subcategory.styleCount > 0),
      };
    })
    .filter((category) => category.styleCount > 0);
}

/** Home page: one slide per live category. */
export function getHomeHeroSlides(categories: LiveCategory[]): HeroSlide[] {
  return categories.map((category) => {
    const copy = getCopy(category.id, category.name);
    return {
      id: category.id,
      eyebrow: category.name,
      headline: copy.headline,
      text: copy.text,
      ctaLabel: `Shop ${category.name.toLowerCase()}`,
      ctaTo: paths.collection(category.id),
      images: heroImages(category.id, category.name, category.products),
    };
  });
}

/** Category or subcategory page: a single slide for that page's category only. */
export function getCollectionHeroSlide(
  path: string,
  products: CatalogueProduct[],
): HeroSlide | null {
  const [categoryId, subcategoryId] = path.split("/");
  const category = categoryData.categories.find((item) => item.id === categoryId);
  const subcategory = subcategoryId
    ? category?.subcategories.find((item) => item.id === subcategoryId)
    : undefined;
  if (!category || (subcategoryId && !subcategory)) {
    return null;
  }
  const inCategory = products.filter((product) =>
    categoryContainsProduct(path, product.category),
  );
  if (inCategory.length === 0) {
    return null;
  }

  const copy = getCopy(category.id, category.name);
  return {
    id: path,
    eyebrow: category.name,
    headline: subcategory ? subcategory.name : copy.headline,
    text: subcategory ? null : copy.text,
    ctaLabel: "Browse styles",
    ctaTo: { hash: "collection" },
    images: heroImages(path, subcategory?.name ?? category.name, inCategory),
  };
}
