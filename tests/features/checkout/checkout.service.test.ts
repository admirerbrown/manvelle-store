import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("../../../src/lib/supabase/client", () => ({
  getSupabaseClient: vi.fn(() => ({ rpc: rpcMock })),
}));

import { getSupabaseClient } from "../../../src/lib/supabase/client";
import {
  createGuestOrder,
  GuestOrderSubmissionError,
} from "../../../src/features/checkout/checkout.service";
import type { GuestOrderInput } from "../../../src/features/checkout/checkout.service";

const input: GuestOrderInput = {
  customerName: "Kofi Mensah",
  customerPhone: "0241234567",
  deliveryArea: "East Legon",
  deliveryAddress: "House 12, East Legon",
  isAccra: true,
  acceptsAdvancePayment: false,
  items: [{ productId: "p1", variantId: "v1", imageId: null, quantity: 2 }],
  attribution: {
    fbp: null,
    fbc: null,
    pageUrl: "https://manvelle.example/checkout",
    userAgent: "test browser",
    metaConsent: false,
  },
};

describe("createGuestOrder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSupabaseClient).mockReturnValue({
      rpc: rpcMock,
    } as unknown as ReturnType<typeof getSupabaseClient>);
  });

  it("throws a GuestOrderSubmissionError when Supabase is not configured", async () => {
    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error("Supabase is not configured.");
    });
    await expect(createGuestOrder("key-1", input)).rejects.toBeInstanceOf(
      GuestOrderSubmissionError,
    );
  });

  it("parses a successful RPC response into a confirmation", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        order_number: "MNV-1001",
        subtotal: 100,
        delivery_fee: 0,
        total: 100,
        payment_method: "cash_on_delivery",
        is_accra: true,
        delivery_area: "East Legon",
        items: [
          {
            product_name: "Cargo Trousers",
            size: "L",
            unit_price: 50,
            quantity: 2,
            subtotal: 100,
          },
        ],
      },
      error: null,
    });
    const result = await createGuestOrder("key-1", input);
    expect(result.orderNumber).toBe("MNV-1001");
    expect(result.subtotal).toBe(100);
    expect(result.deliveryFee).toBe(0);
    expect(result.total).toBe(100);
    expect(result.deliveryArea).toBe("East Legon");
    expect(result.paymentMethod).toBe("cash_on_delivery");
    expect(result.items).toHaveLength(1);
    expect(result.items.at(0)?.productName).toBe("Cargo Trousers");
    expect(rpcMock).toHaveBeenCalledWith(
      "create_guest_order",
      expect.objectContaining({
        p_idempotency_key: "key-1",
        p_customer_name: "Kofi Mensah",
        p_customer_phone: "0241234567",
        p_delivery_area: "East Legon",
        p_delivery_address: "House 12, East Legon",
        p_is_accra: true,
        p_accepts_advance_payment: false,
        p_items: [
          {
            product_id: "p1",
            variant_id: "v1",
            quantity: 2,
          },
        ],
      }),
    );
  });

  it("rejects malformed RPC confirmations rather than returning invalid order details", async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        order_number: "not-an-order-number",
        subtotal: 100,
        delivery_fee: 0,
        total: 100,
        payment_method: "cash_on_delivery",
        is_accra: true,
        delivery_area: "East Legon",
        items: [
          {
            product_name: "Cargo Trousers",
            size: "L",
            unit_price: 50,
            quantity: 2,
            subtotal: 100,
          },
        ],
      },
      error: null,
    });

    await expect(createGuestOrder("key-1", input)).rejects.toMatchObject({
      name: "GuestOrderSubmissionError",
      canEditOrder: false,
      message: "We couldn't read the order confirmation. Retry the same submission to verify it safely.",
    });
  });

  it("throws a customer-facing submission error when the RPC returns an error", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: "name between 2 and 120", code: "22023" },
    });
    await expect(createGuestOrder("key-1", input)).rejects.toMatchObject({
      message: "Enter your name using 2 to 120 characters.",
    });
  });
});
