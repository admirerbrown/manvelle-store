import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminOrders, type AdminOrder, type AdminOrderStatus } from "./admin.service";
import { formatGhs } from "../lib/format-currency";

function todayAccra(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Accra" }).format(new Date());
}

function rangeForDate(value: string): [string, string] {
  const start = new Date(`${value}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  return [start.toISOString(), end.toISOString()];
}

export function OrdersPage() {
  const [date, setDate] = useState(todayAccra());
  const [status, setStatus] = useState<AdminOrderStatus | "all">("all");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    const [start, end] = date ? rangeForDate(date) : [null, null];
    listAdminOrders(start, end, status).then(setOrders).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  };
  useEffect(load, [date, status]);
  const total = useMemo(() => orders.filter((order) => order.order_status !== "cancelled").reduce((sum, order) => sum + order.total, 0), [orders]);
  return (
    <section>
      <div className="admin-title-row"><div><p className="admin-kicker">Orders</p><h1>Order desk</h1></div><button className="admin-button admin-button--quiet" type="button" onClick={load}>Refresh</button></div>
      <div className="admin-filters"><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><button className="admin-link" type="button" onClick={() => setDate("")}>All dates</button><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as AdminOrderStatus | "all")}><option value="all">All</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></div>
      <div className="admin-summary"><strong>{orders.length} orders</strong><strong>{formatGhs(total)} value</strong><span>{orders.filter((order) => order.order_status === "pending").length} pending</span><span>{orders.filter((order) => order.order_status === "completed").length} completed</span><span>{orders.filter((order) => order.order_status === "cancelled").length} cancelled</span></div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p className="admin-status">Loading orders…</p> : <div className="admin-order-list">{orders.map((order) => <Link className="admin-order-row" to={`/admin/orders/${order.id}`} key={order.id}><span><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {order.customer_name}</small></span><span><strong>{formatGhs(order.total)}</strong><small>{order.customer_phone}</small></span><span className={`admin-badge admin-badge--${order.order_status}`}>{order.order_status}</span></Link>)}</div>}
    </section>
  );
}
