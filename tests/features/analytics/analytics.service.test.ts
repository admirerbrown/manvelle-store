import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("../../../src/lib/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({ rpc: rpcMock })),
}));

import { trackStorefrontEvent } from "../../../src/features/analytics/analytics.service";
import {
  captureCheckoutAttribution,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from "../../../src/features/analytics/consent";

describe("storefront analytics consent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "_fbp=; Max-Age=0";
    document.cookie = "_fbc=; Max-Age=0";
    document.getElementById("manvelle-gtm-script")?.remove();
    window.dataLayer = undefined;
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("sends ecommerce events to GTM and the private analytics RPC after consent", () => {
    setAnalyticsConsent(true);

    trackStorefrontEvent({
      name: "add_to_cart",
      productId: "product-1",
      variantId: "variant-1",
      productName: "Everyday shirt",
      variantName: "Large",
      price: 120,
      quantity: 2,
    });

    expect(document.getElementById("manvelle-gtm-script")).not.toBeNull();
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "add_to_cart",
        ecommerce: {
          currency: "GHS",
          value: 240,
          items: [
            {
              item_id: "product-1",
              item_name: "Everyday shirt",
              item_variant: "Large",
              price: 120,
              quantity: 2,
            },
          ],
        },
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "track_storefront_event",
      expect.objectContaining({
        p_event_name: "add_to_cart",
        p_product_id: "product-1",
        p_variant_id: "variant-1",
        p_quantity: 2,
      }),
    );
  });

  it("still loads GTM and records marketing analytics even when the shopper rejects consent", () => {
    setAnalyticsConsent(false);

    trackStorefrontEvent({
      name: "page_view",
      page: "shop",
      pageLocation: "https://manvelle.example/",
    });

    expect(getAnalyticsConsent()).toBe(false);
    expect(document.getElementById("manvelle-gtm-script")).not.toBeNull();
    expect(window.dataLayer).toContainEqual(
      expect.objectContaining({
        event: "page_view",
        page_type: "shop",
        page_location: "https://manvelle.example/",
      }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "track_storefront_event",
      expect.objectContaining({
        p_event_name: "page_view",
        p_page: "shop",
      }),
    );
  });

  it("captures Meta cookies only when consent is granted", () => {
    document.cookie = "_fbp=fb.1.123.456";
    document.cookie = "_fbc=fb.1.123.click";

    setAnalyticsConsent(false);
    expect(captureCheckoutAttribution()).toMatchObject({
      fbp: null,
      fbc: null,
      metaConsent: false,
    });

    setAnalyticsConsent(true);
    expect(captureCheckoutAttribution()).toMatchObject({
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.click",
      metaConsent: true,
    });
    expect(getAnalyticsConsent()).toBe(true);
  });
});
