import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminOrder, updateAdminOrderStatus, type AdminOrder, type AdminOrderItemView, type AdminOrderStatus } from "./admin.service";
import { formatGhs } from "../lib/format-currency";
import { buildReceiptLink } from "../lib/receipt";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [items, setItems] = useState<AdminOrderItemView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { getAdminOrder(id).then(({ order: next, items: nextItems }) => { setOrder(next); setItems(nextItems); }).catch((cause) => setError(cause.message)); }, [id]);
  async function changeStatus(status: AdminOrderStatus) {
    if (!order || (status === "cancelled" && !window.confirm("Cancel this order?"))) return;
    try { await updateAdminOrderStatus(order.id, status); setOrder({ ...order, order_status: status }); setMessage("Order status updated."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the order."); }
  }
  if (!order) return <p className="admin-status">{error ?? "Loading order…"}</p>;
  return <section><nav className="admin-detail-nav" aria-label="Order actions"><Link className="admin-link" to="/admin/orders">← Back to orders</Link><div className="admin-detail-nav__actions"><label className="admin-status-select"><span>Order status</span><select value={["pending", "completed", "cancelled"].includes(order.order_status) ? order.order_status : "pending"} onChange={(event) => changeStatus(event.target.value as AdminOrderStatus)}><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label><a className="admin-button admin-button--whatsapp" href={buildReceiptLink(order, items)} target="_blank" rel="noreferrer">Send receipt on WhatsApp</a></div></nav><div className="admin-order-heading"><p className="admin-kicker">{order.order_number}</p></div><div className="admin-detail-grid"><div><h2>Customer</h2><dl className="admin-customer-details"><div><dt>Name</dt><dd>{order.customer_name}</dd></div><div><dt>Number</dt><dd>{order.customer_phone}</dd></div><div><dt>Address</dt><dd>{order.delivery_address}</dd></div>{order.notes && <div><dt>Notes</dt><dd>{order.notes}</dd></div>}</dl></div><div><h2>Items</h2><div className="admin-items">{items.map((item) => <div className="admin-item" key={item.id}>{item.imageUrl ? <img className="admin-item__media" src={item.imageUrl} alt="" loading="lazy" decoding="async" /> : <div className="admin-item__media" aria-hidden="true" />}<div className="admin-item__info"><p className="admin-item__name">{item.product_name_snapshot}</p><p className="admin-item__meta">{[`Size ${item.size_snapshot}`, `Qty ${item.quantity}`, item.colorName].filter(Boolean).join(" · ")}</p></div><strong>{formatGhs(item.line_subtotal)}</strong></div>)}</div><p className="admin-total">Total <strong>{formatGhs(order.total)}</strong></p></div></div>{message && <p className="admin-success" role="status">{message}</p>}{error && <p className="admin-error" role="alert">{error}</p>}</section>;
}
