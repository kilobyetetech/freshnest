"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { listPendingPayments } from "@/lib/firestore/orders";

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
      {error && <p className="error">{error}</p>}

      <div className="card">
        <strong>Payments awaiting verification</strong>
      </div>

      {payments.length === 0 && (
        <p style={{ color: "#666", fontSize: 14 }}>Nothing pending right now.</p>
      )}

      {payments.map((p) => (
        <div className="card" key={p.id}>
          <strong>₦{p.amountExpected as number}</strong>
          <p style={{ fontSize: 13, color: "#444", margin: "4px 0" }}>
            Ref: {p.transactionReference as string}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="button"
              style={{ background: "#1a7f4e", fontSize: 13, padding: 8 }}
              disabled={busyId === p.id}
              onClick={() => handleDecision(p.id, "confirm")}
            >
              Confirm
            </button>
            <button
              className="button"
              style={{ background: "#b00020", fontSize: 13, padding: 8 }}
              disabled={busyId === p.id}
              onClick={() => handleDecision(p.id, "reject")}
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      <button className="button" style={{ background: "#999", marginTop: 16 }} onClick={() => signOut(auth)}>
        Log out
      </button>
    </main>
  );
}
