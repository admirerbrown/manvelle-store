import { describe, it, expect } from "vitest";
import { buildReceiptLink } from "../../src/lib/receipt";

describe("buildReceiptLink", () => {
  it("builds a WhatsApp receipt message with the customer order details", () => {
    const order = {
      order_number: "MNV-1001",
      customer_name: "Kofi Mensah",
      customer_phone: "+233241234567",
      total: 145.5,
      order_status: "Processing",
      created_at: "2026-11-09T12:00:00Z",
    };

    const items = [
      {
        product_name_snapshot: "Cargo Trousers",
        size_snapshot: "L",
        colorName: "Khaki",
        quantity: 2,
        line_subtotal: 100,
      },
      {
        product_name_snapshot: "Cotton Tee",
        size_snapshot: "M",
        colorName: null,
        quantity: 1,
        line_subtotal: 45.5,
      },
    ];

    const link = buildReceiptLink(order, items);

    expect(link).toContain("https://wa.me/");
    expect(link).toContain("Order%20MNV-1001");
    expect(link).toContain("Cargo%20Trousers");
    expect(link).toContain("GH%E2%82%B5");
    expect(link).toContain("Status%3A%20Processing");
  });
});
