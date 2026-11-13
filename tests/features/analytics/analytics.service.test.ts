import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("../../../src/lib/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({ rpc: rpcMock })),
}));

import { trackStorefrontEvent } from "../../../src/features/analytics/analytics.service";
import {
  captureCheckoutAttribution,
  setAnalyticsConsent,
} from "../../../src/features/analytics/consent";

describe("storefront analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "_fbp=; Max-Age=0";
    document.cookie = "_fbc=; Max-Age=0";
    document.getElementById("manvelle-gtm-script")?.remove();
    window.dataLayer = undefined;
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("loads GTM and sends ecommerce events without a consent choice", () => {
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
    expect(window.dataLayer).toContainEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ]);
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

  it("keeps GTM loaded when optional analytics are rejected", () => {
    setAnalyticsConsent(false);

    expect(document.getElementById("manvelle-gtm-script")).not.toBeNull();
    expect(window.dataLayer).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ]);
  });

  it("captures Meta attribution cookies for checkout", () => {
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
  });
});
