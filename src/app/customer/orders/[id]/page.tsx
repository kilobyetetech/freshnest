"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOrder, getOrderStatusHistory } from "@/lib/firestore/orders";
import { listActivePaymentAccounts } from "@/lib/firestore/catalog";
import { auth } from "@/lib/firebase/client";
import type { OrderDoc, PaymentAccountDoc } from "@/types/models";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<(OrderDoc & { id: string }) | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; newStatus?: string; note?: string }>>([]);
  const [accounts, setAccounts] = useState<Array<PaymentAccountDoc & { id: string }>>([]);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function refresh() {
    const [o, h, a] = await Promise.all([
      getOrder(params.id),
      getOrderStatusHistory(params.id),
      listActivePaymentAccounts(),
    ]);
    setOrder(o);
    setHistory(h as any);
    setAccounts(a);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/submit-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ orderId: params.id, transactionReference: reference }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit payment.");
      setSuccess(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit payment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page">Loading…</main>;
  if (!order) return <main className="page">Order not found.</main>;

  return (
    <main className="page">
      <h1>Order</h1>
      <div className="card">
        <strong>Total: ₦{order.pricingSnapshot.total}</strong>
        <p style={{ fontSize: 14, color: "#444", margin: "4px 0" }}>
          {order.orderStatus} — Payment: {order.paymentStatus}
        </p>
        <div style={{ fontSize: 13, color: "#666" }}>
          {order.pricingSnapshot.items.map((it, i) => (
            <div key={i}>
              {it.name} × {it.quantity} — ₦{it.subtotal}
            </div>
          ))}
          <div>Pickup fee: ₦{order.pricingSnapshot.pickupFee}</div>
          <div>Delivery fee: ₦{order.pricingSnapshot.deliveryFee}</div>
          {order.pricingSnapshot.discount > 0 && <div>Discount: -₦{order.pricingSnapshot.discount}</div>}
        </div>
      </div>

      {order.paymentStatus === "Unpaid" || order.paymentStatus === "Rejected" ? (
        <div className="card">
          <strong>Make a payment</strong>
          {accounts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#b00020" }}>
              No payment account is set up yet — check back soon.
            </p>
          ) : (
            <>
              {accounts.map((a) => (
                <p key={a.id} style={{ fontSize: 13, color: "#444" }}>
                  {a.bankName} — {a.accountName} — {a.accountNumber}
                </p>
              ))}
              {error && <p className="error">{error}</p>}
              {success ? (
                <p style={{ color: "#1a7f4e", fontSize: 14 }}>
                  Submitted — awaiting verification.
                </p>
              ) : (
                <form onSubmit={handleSubmitPayment}>
                  <input
                    className="field"
                    placeholder="Transaction reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                  />
                  <button className="button" type="submit" disabled={busy}>
                    {busy ? "Submitting…" : "Submit payment"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <strong>Payment: {order.paymentStatus}</strong>
        </div>
      )}

      <h2 style={{ marginTop: 24 }}>History</h2>
      {history.map((h) => (
        <div key={h.id} className="card">
          <strong>{h.newStatus}</strong>
          {h.note && <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{h.note}</p>}
        </div>
      ))}
    </main>
  );
}
