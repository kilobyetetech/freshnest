"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";

type Order = Record<string, unknown> & { id: string };
export default function FinanceOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]); const [q, setQ] = useState(""); const [loading, setLoading] = useState(true);
  async function load(search = q) { setLoading(true); const token = await auth.currentUser?.getIdToken(); const res = await fetch(`/api/admin/order-history?q=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${token ?? ""}` } }); const data = await res.json(); setOrders(data.orders ?? []); setLoading(false); }
  useEffect(() => { void load(""); }, []);
  return <main className="page wide"><h1>Order & payment history</h1><p className="muted">Search historical records by Order ID or customer.</p><form className="actions" onSubmit={(e) => { e.preventDefault(); void load(); }}><input aria-label="Search orders" placeholder="Order ID or customer" value={q} onChange={(e) => setQ(e.target.value)} /><button className="button" type="submit">Search</button></form>{loading ? <p>Loading…</p> : orders.length === 0 ? <div className="empty"><strong>No orders found</strong></div> : <div className="list-group">{orders.map((order) => <div className="list-row" key={order.id}><span className="list-text"><strong className="list-title">{String(order.orderNumber ?? "Legacy order")}</strong><span className="list-sub">{String(order.customerName ?? order.customerId ?? "Unknown customer")} · {String(order.paymentStatus ?? "Unpaid")} · Ref: {String(order.paymentReference ?? "Not submitted")}</span></span><strong>₦{Number((order.pricingSnapshot as { total?: number } | undefined)?.total ?? 0).toLocaleString()}</strong></div>)}</div>}</main>;
}
