import { describe, it, expect } from "vitest";
import { getCartLineKey } from "../../../src/features/cart/cart.types";

describe("getCartLineKey", () => {
  it("builds a stable identity for a product variant and image combination", () => {
    expect(getCartLineKey({ variantId: "v-1", imageId: "img-1" })).toBe("v-1:img-1");
  });

  it("handles missing images consistently", () => {
    expect(getCartLineKey({ variantId: "v-2", imageId: null })).toBe("v-2:");
  });
});
