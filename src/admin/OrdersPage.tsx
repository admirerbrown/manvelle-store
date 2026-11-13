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

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Accra",
  }).format(new Date(value));
}

export function OrdersPage() {
  const [date, setDate] = useState(todayAccra());
  const [status, setStatus] = useState<AdminOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
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
  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) =>
      [order.order_number, order.customer_name, order.customer_phone]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [orders, search]);
  return (
    <section className="orders-page">
      <div className="admin-summary">
        <div className="orders-stat orders-stat--primary"><span className="orders-stat-label">Visible orders</span><strong>{orders.length}</strong><small>{date ? `For ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Accra" }).format(new Date(`${date}T00:00:00`))}` : "Across all dates"}</small></div>
        <div className="orders-stat"><span className="orders-stat-label">Order value</span><strong>{formatGhs(total)}</strong><small>Excludes cancelled orders</small></div>
        <div className="orders-stat"><span className="orders-stat-label">Needs attention</span><strong>{orders.filter((order) => order.order_status === "pending").length}</strong><small>Pending fulfilment</small></div>
        <div className="orders-stat orders-stat--split"><span><strong>{orders.filter((order) => order.order_status === "completed").length}</strong><small>Completed</small></span><span><strong>{orders.filter((order) => order.order_status === "cancelled").length}</strong><small>Cancelled</small></span></div>
      </div>
      <div className="admin-filters orders-toolbar">
        <label className="orders-search"><span>Search orders</span><input type="search" placeholder="Order number, customer, phone" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button className="admin-link" type="button" onClick={() => setDate("")}>All dates</button>
        <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as AdminOrderStatus | "all")}><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p className="admin-status">Loading orders…</p> : visibleOrders.length > 0 ? <div className="admin-order-list">{visibleOrders.map((order) => <Link className="admin-order-row" to={`/admin/orders/${order.id}`} key={order.id}><span className="order-primary"><strong>{order.order_number}</strong><small>{formatOrderDate(order.created_at)} · {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" })} · {order.customer_name}</small></span><span className="order-customer"><strong>{order.customer_phone}</strong><small>Customer contact</small></span><span className="order-total"><strong>{formatGhs(order.total)}</strong><small>Order total</small></span><span className={`admin-badge admin-badge--${order.order_status}`}>{order.order_status}</span><span className="order-arrow" aria-hidden="true">↗</span></Link>)}</div> : <div className="orders-empty"><span aria-hidden="true">◎</span><h2>No orders found</h2><p>{search ? "Try a different order number, customer name, or phone number." : "There are no orders matching these filters yet."}</p></div>}
    </section>
  );
}
