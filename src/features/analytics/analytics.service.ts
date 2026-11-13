import { getSupabaseClient } from "../../lib/supabase/client";
import { initializeGoogleTagManager } from "./consent";

export type StorefrontPage = "shop" | "checkout" | "confirmation";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_variant?: string;
  price: number;
  quantity: number;
};

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
  | {
      name: "page_view";
      page: StorefrontPage;
      pageLocation: string;
    }
  | {
      name: "product_view";
      productId: string;
      productName: string;
      price: number;
    }
  | {
      name: "product_variant_selected";
      productId: string;
      variantId: string;
    }
  | {
      name: "add_to_cart";
      productId: string;
      variantId: string;
      productName: string;
      variantName: string;
      price: number;
      quantity: number;
    }
  | {
      name: "checkout_started";
      items: AnalyticsItem[];
      value: number;
    }
  | {
      name: "order_confirmed";
      orderNumber: string;
      items: AnalyticsItem[];
      value: number;
    };

const analyticsSessionStorageKey = "manvelle.analytics.session_id";
const sessionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function trackStorefrontEvent(event: StorefrontClientEvent): void {
  try {
    initializeGoogleTagManager();
    pushGtmEvent(event);
  } catch (cause) {
    console.error(
      `Could not send storefront analytics event "${event.name}" to GTM.`,
      cause,
    );
  }

  void persistStorefrontEvent(event).catch((cause: unknown) => {
    console.error(
      `Could not record storefront analytics event "${event.name}".`,
      cause,
    );
  });
}

function pushGtmEvent(event: StorefrontClientEvent): void {
  const dataLayer = window.dataLayer;
  if (!dataLayer) {
    throw new Error("Google Tag Manager dataLayer is unavailable.");
  }

  dataLayer.push({ ecommerce: null });
  switch (event.name) {
    case "page_view":
      dataLayer.push({
        event: "page_view",
        page_type: event.page,
        page_location: event.pageLocation,
        page_path: new URL(event.pageLocation).pathname,
      });
      return;
    case "product_view":
      dataLayer.push({
        event: "view_item",
        ecommerce: {
          currency: "GHS",
          value: event.price,
          items: [
            {
              item_id: event.productId,
              item_name: event.productName,
              price: event.price,
              quantity: 1,
            },
          ],
        },
      });
      return;
    case "add_to_cart":
      dataLayer.push({
        event: "add_to_cart",
        ecommerce: {
          currency: "GHS",
          value: event.price * event.quantity,
          items: [
            {
              item_id: event.productId,
              item_name: event.productName,
              item_variant: event.variantName,
              price: event.price,
              quantity: event.quantity,
            },
          ],
        },
      });
      return;
    case "checkout_started":
      dataLayer.push({
        event: "begin_checkout",
        ecommerce: {
          currency: "GHS",
          value: event.value,
          items: event.items,
        },
      });
      return;
    case "order_confirmed":
      dataLayer.push({
        event: "order_placed",
        ecommerce: {
          transaction_id: event.orderNumber,
          currency: "GHS",
          value: event.value,
          items: event.items,
        },
      });
      return;
    case "product_variant_selected":
      dataLayer.push({
        event: "select_item",
        ecommerce: {
          items: [
            {
              item_id: event.productId,
              item_variant: event.variantId,
              quantity: 1,
            },
          ],
        },
      });
  }
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
