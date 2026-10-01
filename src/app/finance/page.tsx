"use client";

import { useEffect, useState } from "react";
import { listPendingPayments } from "@/lib/firestore/orders";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/Icon";

export default function FinanceDashboard() {
  const [payments, setPayments] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setPayments(await listPendingPayments());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDecision(paymentId: string, decision: "confirm" | "reject") {
    setError(null);
    let rejectionReason: string | undefined;
    if (decision === "reject") {
      rejectionReason = window.prompt("Reason for rejecting this payment?") ?? undefined;
      if (!rejectionReason) return;
    }
    setBusyId(paymentId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ paymentId, decision, rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not process payment.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process payment.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Finance</h1>

      <div className="stat-band" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className={`stat-value ${payments.length ? "attention" : ""}`}>{payments.length}</div>
          <div className="stat-label">Awaiting verification</div>
        </div>
      </div>

      <div className="section-title">Payments awaiting verification</div>
      {error && <p className="error">{error}</p>}

      {payments.length === 0 ? (
        <div className="empty">
          <strong>All caught up</strong>
          Nothing is waiting on you right now.
        </div>
      ) : (
        payments.map((p) => (
          <div className="card" key={p.id}>
            <div className="row-between">
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem" }}>
                ₦{p.amountExpected as number}
              </strong>
              <Icon name="receipt" />
            </div>
            <p className="muted" style={{ fontSize: "0.88rem", margin: "4px 0 12px" }}>
              Ref: {p.transactionReference as string}
            </p>
            <div className="actions">
              <button
                className="button small"
                disabled={busyId === p.id}
                onClick={() => handleDecision(p.id, "confirm")}
              >
                Confirm
              </button>
              <button
                className="button danger small"
                disabled={busyId === p.id}
                onClick={() => handleDecision(p.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </main>
  );
}
