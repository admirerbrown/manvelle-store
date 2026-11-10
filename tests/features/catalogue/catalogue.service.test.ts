import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/features/catalogue/catalog-images", () => ({
  getLocalCatalogImages: vi.fn(() => []),
  getLocalProductImageUrl: vi.fn(() => null),
  getCategoryImages: vi.fn(() => []),
}));

import { isVariantInStock } from "../../../src/features/catalogue/catalogue.service";

const inStockProduct = { availability: "in-stock" as const };
const outOfStockProduct = { availability: "out-of-stock" as const };

describe("isVariantInStock", () => {
  it("is true when the product is in stock and the variant has no quantity cap", () => {
    expect(isVariantInStock(inStockProduct, { stock_quantity: null })).toBe(true);
  });

  it("is true when the variant still has stock", () => {
    expect(isVariantInStock(inStockProduct, { stock_quantity: 5 })).toBe(true);
    expect(isVariantInStock(inStockProduct, { stock_quantity: 1 })).toBe(true);
  });

  it("is false when the variant's stock quantity is zero", () => {
    expect(isVariantInStock(inStockProduct, { stock_quantity: 0 })).toBe(false);
  });

  it("is false when the product itself is out of stock, regardless of variant stock", () => {
    expect(isVariantInStock(outOfStockProduct, { stock_quantity: null })).toBe(false);
    expect(isVariantInStock(outOfStockProduct, { stock_quantity: 5 })).toBe(false);
    expect(isVariantInStock(outOfStockProduct, { stock_quantity: 0 })).toBe(false);
  });
});
