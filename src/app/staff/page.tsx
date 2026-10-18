"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auth } from "@/lib/firebase/client";
import type { OrderStatus } from "@/types/models";

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  Received: "Sorting",
  Sorting: "Washing",
  Washing: "Drying",
  Drying: "IroningFolding",
  IroningFolding: "QualityCheck",
};

type ProcessingOrder = {
  id: string;
  orderNumber: string | null;
  customerId: string | null;
  orderStatus: OrderStatus;
  intakeNotes: string | null;
  qualityControl: { passed?: boolean; notes?: string } | null;
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ProcessingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch("/api/staff/processing", { headers: { Authorization: `Bearer ${token ?? ""}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load processing queue.");
    setOrders(data.orders);
  }

  useEffect(() => {
    if (!user) return;
    void refresh().catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load processing queue.")).finally(() => setLoading(false));
  }, [user]);

  async function advance(order: ProcessingOrder, qcPassed?: boolean) {
    const toStatus = qcPassed === false ? "Washing" : qcPassed === true ? "ReadyForDelivery" : NEXT[order.orderStatus];
    if (!toStatus) return;
    setBusy(order.id); setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/orders/${order.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ toStatus, qcPassed, reason: qcPassed === undefined ? `Processing: ${toStatus}` : qcPassed ? "Quality control passed" : "Quality control failed; rework required" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Transition failed.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transition failed.");
    } finally { setBusy(null); }
  }

  if (loading) return <main className="page">Loading processing queue…</main>;
  return <main className="page wide">
    <h1>Facility processing</h1>
    <p className="muted">Advance each order one validated stage at a time. Quality decisions are completed from the order workflow.</p>
    {error && <div className="error" role="alert">{error}</div>}
    {orders.length === 0 ? <div className="empty"><strong>No orders require processing</strong>Completed intake orders will appear here.</div> : <div className="list-group">
      {orders.map((order) => <div className="list-row" key={order.id}>
        <div className="list-text"><strong>{order.orderNumber ?? order.id}</strong><span className="list-sub">Customer {order.customerId ?? "unassigned"} · {order.orderStatus}</span>{order.intakeNotes && <span className="list-sub">Intake: {order.intakeNotes}</span>}</div>
        {order.orderStatus === "QualityCheck" ? <div className="actions"><button className="button" disabled={busy === order.id} onClick={() => void advance(order, true)}>Pass QC</button><button className="button secondary" disabled={busy === order.id} onClick={() => void advance(order, false)}>Fail and rework</button></div> : NEXT[order.orderStatus] && <button className="button" disabled={busy === order.id} onClick={() => void advance(order)}>{busy === order.id ? "Updating…" : `Mark ${NEXT[order.orderStatus]}`}</button>}
      </div>)}
    </div>}
  </main>;
}
