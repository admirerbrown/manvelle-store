import { describe, it, expect } from "vitest";
import { resolveRoute, getCategoryLabel, paths } from "../../src/app/routes";

describe("resolveRoute", () => {
  it("resolves the home route", () => {
    expect(resolveRoute("/")).toEqual({ name: "home" });
  });

  it("resolves a product route", () => {
    expect(resolveRoute("/products/cargo-pants")).toEqual({
      name: "product",
      slug: "cargo-pants",
    });
  });

  it("resolves a top-level collection route", () => {
    expect(resolveRoute("/collections/pants")).toEqual({
      name: "collection",
      categoryId: "pants",
    });
  });

  it("resolves a subcategory collection route", () => {
    expect(resolveRoute("/collections/pants/office")).toEqual({
      name: "collection",
      categoryId: "pants/office",
    });
  });

  it("resolves the collection index", () => {
    expect(resolveRoute("/collections/")).toEqual({ name: "collection-index" });
  });

  it("resolves the static page routes", () => {
    expect(resolveRoute("/bag")).toEqual({ name: "bag" });
    expect(resolveRoute("/checkout")).toEqual({ name: "checkout" });
    expect(resolveRoute("/order-confirmation")).toEqual({ name: "confirmation" });
    expect(resolveRoute("/faq")).toEqual({ name: "faq" });
    expect(resolveRoute("/contact")).toEqual({ name: "contact" });
  });

  it("returns not-found for unknown routes", () => {
    expect(resolveRoute("/nothing-here")).toEqual({ name: "not-found" });
    expect(resolveRoute("/collections/unknown")).toEqual({ name: "not-found" });
  });
});

describe("getCategoryLabel", () => {
  it("returns the label for a known category", () => {
    expect(getCategoryLabel("pants")).toBe("Pants");
    expect(getCategoryLabel("pants/office")).toBe("Pants / Office");
    expect(getCategoryLabel("mens-underwear/boxers")).toBe("Men's underwear / Boxers");
  });

  it("returns null for an unknown category", () => {
    expect(getCategoryLabel("nope")).toBeNull();
  });
});

describe("paths", () => {
  it("builds collection and product URLs", () => {
    expect(paths.collection("pants/office")).toBe("/collections/pants/office");
    expect(paths.product("cargo-pants")).toBe("/products/cargo-pants");
  });
});
