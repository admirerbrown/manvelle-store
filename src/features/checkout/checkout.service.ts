import type { CartLine } from "../cart/cart.types";
import { getSupabaseClient } from "../../lib/supabase/client";

export type GuestOrderInput = {
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  deliveryAddress: string;
  isAccra: boolean;
  acceptsAdvancePayment: boolean;
  items: CartLine[];
};

export type GuestOrderConfirmation = {
  orderNumber: string;
  items: GuestOrderConfirmationItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryArea: string;
  isAccra: boolean;
  paymentMethod: "cash_on_delivery" | "payment_before_delivery_on_whatsapp";
};

export type GuestOrderConfirmationItem = {
  productName: string;
  size: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
};

export class GuestOrderSubmissionError extends Error {
  constructor(
    message: string,
    readonly canEditOrder: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GuestOrderSubmissionError";
  }
}

export async function createGuestOrder(
  idempotencyKey: string,
  order: GuestOrderInput,
): Promise<GuestOrderConfirmation> {
  let client: ReturnType<typeof getSupabaseClient>;
  try {
    client = getSupabaseClient();
  } catch (cause) {
    throw new GuestOrderSubmissionError(
      "Checkout is not configured yet. Please try again later.",
      true,
      { cause },
    );
  }

  try {
    const { data, error } = await client.rpc("create_guest_order", {
      p_idempotency_key: idempotencyKey,
      p_customer_name: order.customerName,
      p_customer_phone: order.customerPhone,
      p_delivery_area: order.deliveryArea,
      p_delivery_address: order.deliveryAddress,
      p_is_accra: order.isAccra,
      p_accepts_advance_payment: order.acceptsAdvancePayment,
      p_items: aggregateOrderItems(order.items),
    });

    if (error) {
      throw new GuestOrderSubmissionError(
        getCustomerErrorMessage(error.message),
        error.code === "22023",
        { cause: error },
      );
    }

    return parseConfirmation(data);
  } catch (cause) {
    if (cause instanceof GuestOrderSubmissionError) {
      throw cause;
    }

    throw new GuestOrderSubmissionError(
      "We couldn't verify whether your order was received. Retry this same submission to check safely.",
      false,
      { cause },
    );
  }
}

function parseConfirmation(value: unknown): GuestOrderConfirmation {
  if (
    !isRecord(value) ||
    typeof value.order_number !== "string" ||
    !/^MNV-\d+$/.test(value.order_number) ||
    !isNonnegativeAmount(value.subtotal) ||
    !isNonnegativeAmount(value.delivery_fee) ||
    !isNonnegativeAmount(value.total) ||
    (value.payment_method !== "cash_on_delivery" &&
      value.payment_method !== "payment_before_delivery_on_whatsapp") ||
    typeof value.is_accra !== "boolean" ||
    (value.is_accra &&
      value.payment_method !== "cash_on_delivery") ||
    (!value.is_accra &&
      value.payment_method !== "payment_before_delivery_on_whatsapp") ||
    typeof value.delivery_area !== "string" ||
    value.delivery_area.trim().length === 0 ||
    !Array.isArray(value.items) ||
    value.items.length === 0
  ) {
    throw new GuestOrderSubmissionError(
      "We couldn't read the order confirmation. Retry the same submission to verify it safely.",
      false,
    );
  }

  const items = value.items.map(parseConfirmationItem);
  if (
    items.some((item) => item === null) ||
    sumCents(items.map((item) => item?.subtotal ?? 0)) !==
      toCents(value.subtotal) ||
    toCents(value.total) !==
      toCents(value.subtotal) + toCents(value.delivery_fee)
  ) {
    throw new GuestOrderSubmissionError(
      "We couldn't read the order confirmation. Retry the same submission to verify it safely.",
      false,
    );
  }

  return {
    orderNumber: value.order_number,
    items: items.filter((item) => item !== null),
    subtotal: value.subtotal,
    deliveryFee: value.delivery_fee,
    total: value.total,
    deliveryArea: value.delivery_area,
    isAccra: value.is_accra,
    paymentMethod: value.payment_method,
  };
}

function parseConfirmationItem(
  value: unknown,
): GuestOrderConfirmationItem | null {
  if (
    !isRecord(value) ||
    typeof value.product_name !== "string" ||
    value.product_name.trim().length === 0 ||
    typeof value.size !== "string" ||
    value.size.trim().length === 0 ||
    !isNonnegativeAmount(value.unit_price) ||
    !Number.isInteger(value.quantity) ||
    typeof value.quantity !== "number" ||
    value.quantity < 1 ||
    !isNonnegativeAmount(value.subtotal) ||
    toCents(value.subtotal) !== toCents(value.unit_price) * value.quantity
  ) {
    return null;
  }

  return {
    productName: value.product_name,
    size: value.size,
    unitPrice: value.unit_price,
    quantity: value.quantity,
    subtotal: value.subtotal,
  };
}

function aggregateOrderItems(items: CartLine[]) {
  const itemsByVariant = new Map<
    string,
    { product_id: string; variant_id: string; quantity: number }
  >();
  for (const item of items) {
    const existing = itemsByVariant.get(item.variantId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      itemsByVariant.set(item.variantId, {
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      });
    }
  }

  return Array.from(itemsByVariant.values());
}

function isNonnegativeAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function sumCents(amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + toCents(amount), 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCustomerErrorMessage(message: string): string {
  if (message.includes("name between 2 and 120")) {
    return "Enter your name using 2 to 120 characters.";
  }
  if (message.includes("valid Ghanaian phone")) {
    return "Enter a valid Ghanaian phone number.";
  }
  if (message.includes("delivery address between 3 and 500")) {
    return "Enter a delivery address using 3 to 500 characters.";
  }
  if (message.includes("delivery area between 2 and 120")) {
    return "Enter an Accra area using 2 to 120 characters.";
  }
  if (message.includes("product or size is no longer available")) {
    return "A product or size in your bag is no longer available. Update your bag.";
  }
  if (message.includes("no longer in stock")) {
    return "The requested quantity is no longer in stock. Update your bag.";
  }
  if (message.includes("order submission key")) {
    return "The order could not be identified. Please try again.";
  }

  return "Your order could not be placed. Review your details and try again.";
}
