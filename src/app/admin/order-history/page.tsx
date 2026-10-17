"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";

type Order = Record<string, unknown> & { id: string };

async function token() { return (await auth.currentUser?.getIdToken()) ?? ""; }

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [backfilling, setBackfilling] = useState(false);

  async function load(search = q) {
    setLoading(true);
    const res = await fetch(`/api/admin/order-history?q=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${await token()}` } });
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(""); }, []);

  async function runBackfill() {
    setBackfilling(true); setMessage("");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` };
    const preview = await fetch("/api/admin/order-history", { method: "POST", headers, body: JSON.stringify({ dryRun: true }) }).then((r) => r.json());
    if (!preview.missing) { setMessage("All orders already have permanent Order IDs."); setBackfilling(false); return; }
    if (!window.confirm(`Assign permanent IDs to ${preview.missing} historical orders?`)) { setBackfilling(false); return; }
    const result = await fetch("/api/admin/order-history", { method: "POST", headers, body: JSON.stringify({ dryRun: false }) }).then((r) => r.json());
    setMessage(`Backfill complete: ${result.updated ?? 0} orders updated.`); setBackfilling(false); await load();
  }

  return <main className="page wide">
    <div className="row-between"><div><h1>Order history</h1><p className="muted">Search current and historical orders by Order ID or customer.</p></div><button className="button small" onClick={runBackfill} disabled={backfilling}>{backfilling ? "Working…" : "Backfill Order IDs"}</button></div>
    {message && <p className="success">{message}</p>}
    <form className="actions" onSubmit={(e) => { e.preventDefault(); void load(); }}><input aria-label="Search orders" placeholder="FN-2026-000001 or customer" value={q} onChange={(e) => setQ(e.target.value)} /><button className="button" type="submit">Search</button></form>
    {loading ? <p>Loading…</p> : orders.length === 0 ? <div className="empty"><strong>No orders found</strong><span>Try another Order ID or customer name.</span></div> : <div className="list-group">{orders.map((order) => <div className="list-row" key={order.id}><span className="list-text"><strong className="list-title">{String(order.orderNumber ?? "Legacy order")}</strong><span className="list-sub">{String(order.customerName ?? order.customerId ?? "Unknown customer")} · {String(order.orderStatus ?? "Pending")} · {String(order.paymentStatus ?? "Unpaid")}</span></span><strong>₦{Number((order.pricingSnapshot as { total?: number } | undefined)?.total ?? 0).toLocaleString()}</strong></div>)}</div>}
  </main>;
}
