import { getSupabaseClient } from "../../lib/supabase/client";

export type StorefrontPage = "shop" | "checkout" | "confirmation";

export type StorefrontEventName =
  | "page_view"
  | "product_view"
  | "product_variant_selected"
  | "add_to_cart"
  | "checkout_started"
  | "order_created"
  | "order_confirmed"
  | "order_delivered"
  | "order_paid";

export type StorefrontClientEvent =
  | { name: "page_view"; page: StorefrontPage }
  | { name: "product_view"; productId: string }
  | {
      name: "product_variant_selected";
      productId: string;
      variantId: string;
    }
  | {
      name: "add_to_cart";
      productId: string;
      variantId: string;
      quantity: number;
    }
  | { name: "checkout_started" }
  | { name: "order_confirmed"; orderNumber: string };

const analyticsSessionStorageKey = "manvelle.analytics.session_id";
const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackStorefrontEvent(event: StorefrontClientEvent): void {
  void persistStorefrontEvent(event).catch((cause: unknown) => {
    console.error(
      `Could not record storefront analytics event "${event.name}".`,
      cause,
    );
  });
}

async function persistStorefrontEvent(
  event: StorefrontClientEvent,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("track_storefront_event", {
    p_event_name: event.name,
    p_session_id: getAnalyticsSessionId(),
    p_product_id: "productId" in event ? event.productId : null,
    p_variant_id: "variantId" in event ? event.variantId : null,
    p_quantity: "quantity" in event ? event.quantity : null,
    p_order_number: "orderNumber" in event ? event.orderNumber : null,
    p_page: "page" in event ? event.page : null,
  });

  if (error) {
    throw new Error("The storefront analytics event was rejected.", {
      cause: error,
    });
  }
}

function getAnalyticsSessionId(): string {
  const storedSessionId = window.sessionStorage.getItem(
    analyticsSessionStorageKey,
  );
  if (storedSessionId && sessionIdPattern.test(storedSessionId)) {
    return storedSessionId;
  }
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Secure analytics session IDs are unavailable.");
  }

  const sessionId = globalThis.crypto.randomUUID();
  window.sessionStorage.setItem(analyticsSessionStorageKey, sessionId);
  return sessionId;
}
