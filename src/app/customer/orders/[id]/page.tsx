"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOrder, getOrderStatusHistory } from "@/lib/firestore/orders";
import { listActivePaymentAccounts } from "@/lib/firestore/catalog";
import { auth } from "@/lib/firebase/client";
import { StatusBadge, humanize } from "@/components/StatusBadge";
import { Icon } from "@/components/Icon";
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
        <div className="row-between" style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem" }}>
            ₦{order.pricingSnapshot.total}
          </span>
          <StatusBadge status={order.orderStatus} />
        </div>
        <p className="muted" style={{ margin: "0 0 12px" }}>Payment: {humanize(order.paymentStatus)}</p>

        {order.pricingSnapshot.items.map((it, i) => (
          <div key={i} className="row-between" style={{ fontSize: "0.92rem", padding: "4px 0" }}>
            <span>{it.name} × {it.quantity}</span>
            <span>₦{it.subtotal}</span>
          </div>
        ))}
        <div className="row-between muted" style={{ fontSize: "0.88rem", padding: "4px 0" }}>
          <span>Pickup fee</span><span>₦{order.pricingSnapshot.pickupFee}</span>
        </div>
        <div className="row-between muted" style={{ fontSize: "0.88rem", padding: "4px 0" }}>
          <span>Delivery fee</span><span>₦{order.pricingSnapshot.deliveryFee}</span>
        </div>
        {order.pricingSnapshot.discount > 0 && (
          <div className="row-between" style={{ fontSize: "0.88rem", padding: "4px 0", color: "var(--ok)" }}>
            <span>Discount</span><span>-₦{order.pricingSnapshot.discount}</span>
          </div>
        )}
      </div>

      {order.paymentStatus === "Unpaid" || order.paymentStatus === "Rejected" ? (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <strong>Make a payment</strong>
            <Icon name="card" />
          </div>
          {accounts.length === 0 ? (
            <p className="muted">No payment account is set up yet — check back soon.</p>
          ) : (
            <>
              {accounts.map((a) => (
                <p key={a.id} className="muted" style={{ fontSize: "0.88rem" }}>
                  {a.bankName} — {a.accountName} — {a.accountNumber}
                </p>
              ))}
              {error && <p className="error">{error}</p>}
              {success ? (
                <p className="badge ok" style={{ marginTop: 8 }}>Submitted — awaiting verification</p>
              ) : (
                <form onSubmit={handleSubmitPayment} style={{ marginTop: 10 }}>
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
      ) : null}

      <div className="section-title">History</div>
      <div className="list-group">
        {history.map((h) => (
          <div key={h.id} className="list-row" style={{ cursor: "default" }}>
            <span className="list-icon"><Icon name="receipt" /></span>
            <span className="list-text">
              <span className="list-title">{h.newStatus}</span>
              {h.note && <span className="list-sub">{h.note}</span>}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
