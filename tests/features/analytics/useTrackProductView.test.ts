import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueProduct } from "../../../src/features/catalogue/catalogue.service";

const { trackStorefrontEventMock } = vi.hoisted(() => ({
  trackStorefrontEventMock: vi.fn(),
}));

vi.mock("../../../src/features/analytics/analytics.service", () => ({
  trackStorefrontEvent: trackStorefrontEventMock,
}));

import { useTrackProductView } from "../../../src/features/analytics/useTrackProductView";

const product: CatalogueProduct = {
  id: "product-1",
  name: "Everyday shirt",
  slug: "everyday-shirt",
  description: "A shirt",
  key_features: "",
  price: 120,
  category: "shirts",
  availability: "in-stock",
  featured: false,
  variants: [],
  images: [],
};

describe("useTrackProductView", () => {
  beforeEach(() => {
    trackStorefrontEventMock.mockClear();
  });

  it("tracks a product once when its data object is replaced", () => {
    const { rerender } = renderHook(
      ({ currentProduct }) => useTrackProductView(currentProduct),
      { initialProps: { currentProduct: product } },
    );

    rerender({ currentProduct: { ...product, name: "Updated shirt" } });

    expect(trackStorefrontEventMock).toHaveBeenCalledOnce();
    expect(trackStorefrontEventMock).toHaveBeenCalledWith({
      name: "product_view",
      productId: "product-1",
      productName: "Everyday shirt",
      price: 120,
    });
  });

  it("tracks a different product ID", () => {
    const { rerender } = renderHook(
      ({ currentProduct }) => useTrackProductView(currentProduct),
      { initialProps: { currentProduct: product } },
    );

    rerender({
      currentProduct: { ...product, id: "product-2", name: "New trousers" },
    });

    expect(trackStorefrontEventMock).toHaveBeenCalledTimes(2);
    expect(trackStorefrontEventMock).toHaveBeenLastCalledWith({
      name: "product_view",
      productId: "product-2",
      productName: "New trousers",
      price: 120,
    });
  });
});
