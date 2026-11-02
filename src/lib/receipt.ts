import { whatsappDigits } from "./phone";

type ReceiptOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  order_status: string;
  created_at: string;
};

type ReceiptItem = {
  product_name_snapshot: string;
  size_snapshot: string;
  quantity: number;
  line_subtotal: number;
};

export function buildReceiptLink(
  order: ReceiptOrder,
  items: ReceiptItem[],
): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(order.created_at));
  const lines = items.map(
    (item) =>
      `${item.quantity} x ${item.product_name_snapshot} (${item.size_snapshot}) - GH₵${item.line_subtotal.toFixed(2)}`,
  );
  const message = [
    `Hello ${order.customer_name}, thank you for ordering from Manvelle Menswear Ghana.`,
    "",
    `Order ${order.order_number}`,
    `Date: ${date}`,
    "",
    "Items:",
    ...lines,
    "",
    `Total: GH₵${order.total.toFixed(2)}`,
    `Status: ${order.order_status}`,
    "",
    "We will contact you about delivery. Thank you.",
  ].join("\n");
  return `https://wa.me/${whatsappDigits(order.customer_phone)}?text=${encodeURIComponent(message)}`;
}
