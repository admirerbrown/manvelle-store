import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAdminOrder, updateAdminOrderStatus, type AdminOrder, type AdminOrderItem, type AdminOrderStatus } from "./admin.service";
import { formatGhs } from "../lib/format-currency";
import { buildReceiptLink } from "../lib/receipt";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [items, setItems] = useState<AdminOrderItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { getAdminOrder(id).then(({ order: next, items: nextItems }) => { setOrder(next); setItems(nextItems); }).catch((cause) => setError(cause.message)); }, [id]);
  async function changeStatus(status: AdminOrderStatus) {
    if (!order || (status === "cancelled" && !window.confirm("Cancel this order?"))) return;
    try { await updateAdminOrderStatus(order.id, status); setOrder({ ...order, order_status: status }); setMessage("Order status updated."); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the order."); }
  }
  if (!order) return <p className="admin-status">{error ?? "Loading order…"}</p>;
  return <section><Link className="admin-link" to="/admin/orders">← Back to orders</Link><div className="admin-title-row"><div><p className="admin-kicker">{order.order_number}</p><h1>Order detail</h1></div><span className={`admin-badge admin-badge--${order.order_status}`}>{order.order_status}</span></div><div className="admin-detail-grid"><div><h2>Customer</h2><p><strong>{order.customer_name}</strong><br />{order.customer_phone}<br />{order.delivery_address}</p>{order.notes && <p>{order.notes}</p>}</div><div><h2>Items</h2><div className="admin-items">{items.map((item) => <div className="admin-item" key={item.id}><span>{item.quantity} × {item.product_name_snapshot}<small>Size {item.size_snapshot}</small></span><strong>{formatGhs(item.line_subtotal)}</strong></div>)}</div><p className="admin-total">Total <strong>{formatGhs(order.total)}</strong></p></div></div><div className="admin-actions"><h2>Update status</h2>{(["pending", "completed", "cancelled"] as AdminOrderStatus[]).map((status) => <button key={status} className={`admin-button ${order.order_status === status ? "admin-button--active" : ""}`} type="button" onClick={() => changeStatus(status)}>{status}</button>)}<a className="admin-button admin-button--whatsapp" href={buildReceiptLink(order, items)} target="_blank" rel="noreferrer">Send receipt on WhatsApp</a></div>{message && <p className="admin-success" role="status">{message}</p>}{error && <p className="admin-error" role="alert">{error}</p>}</section>;
}
