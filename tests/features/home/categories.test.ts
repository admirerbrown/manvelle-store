import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/features/catalogue/catalog-images", () => ({
  getCategoryImages: vi.fn(() => []),
}));

import {
  categoryContainsProduct,
  getLiveCategories,
  getHomeHeroSlides,
  getCollectionHeroSlide,
} from "../../../src/features/home/categories";
import type { CatalogueProduct } from "../../../src/features/catalogue/catalogue.service";
import type { LiveCategory } from "../../../src/features/home/categories";

function product(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  return {
    id: "p1",
    name: "Test Product",
    slug: "test-product",
    description: "A test product",
    key_features: "",
    price: 100,
    category: "pants/office",
    availability: "in-stock",
    featured: false,
    variants: [],
    images: [],
    ...overrides,
  };
}

describe("categoryContainsProduct", () => {
  it("returns true for an exact category match", () => {
    expect(categoryContainsProduct("pants", "pants")).toBe(true);
  });

  it("returns true when the product is in a subcategory of the category", () => {
    expect(categoryContainsProduct("pants", "pants/office")).toBe(true);
  });

  it("returns false for a different category", () => {
    expect(categoryContainsProduct("tops", "pants/office")).toBe(false);
    expect(categoryContainsProduct("pants", "tops/shirts")).toBe(false);
  });

  it("returns false when the product has no category", () => {
    expect(categoryContainsProduct("pants", null)).toBe(false);
  });
});

describe("getLiveCategories", () => {
  it("returns only categories that have at least one product", () => {
    const categories = getLiveCategories([product({ category: "pants/office" })]);
    const ids = categories.map((category) => category.id);
    expect(ids).toContain("pants");
    expect(ids).not.toContain("tops");
  });

  it("excludes subcategories that have no products", () => {
    const categories = getLiveCategories([product({ category: "pants/office" })]);
    const pants = categories.find((category) => category.id === "pants");
    expect(pants?.subcategories.map((sub) => sub.id)).toContain("office");
    expect(pants?.subcategories.map((sub) => sub.id)).not.toContain("casual");
  });

  it("returns an empty array when there are no products", () => {
    expect(getLiveCategories([])).toEqual([]);
  });
});

describe("getHomeHeroSlides", () => {
  it("returns at most four slides", () => {
    const categories: LiveCategory[] = [
      { id: "a", name: "A", products: [product({ category: "a" })] },
      { id: "b", name: "B", products: [product({ category: "b" })] },
      { id: "c", name: "C", products: [product({ category: "c" })] },
      { id: "d", name: "D", products: [product({ category: "d" })] },
      { id: "e", name: "E", products: [product({ category: "e" })] },
    ].map(({ id, name, products }) => ({
      id,
      name,
      products,
      styleCount: products.length,
      subcategories: [],
      coverUrl: null,
    }));
    const slides = getHomeHeroSlides(categories);
    expect(slides.length).toBe(4);
  });
});

describe("getCollectionHeroSlide", () => {
  it("returns null for an unknown category path", () => {
    expect(getCollectionHeroSlide("nope/sub", [])).toBeNull();
  });

  it("returns null when the category has no products", () => {
    expect(getCollectionHeroSlide("pants", [])).toBeNull();
  });

  it("returns a slide when the category path has products", () => {
    const slide = getCollectionHeroSlide("pants/office", [
      product({ category: "pants/office" }),
    ]);
    expect(slide).not.toBeNull();
    expect(slide?.id).toBe("pants/office");
  });
});
