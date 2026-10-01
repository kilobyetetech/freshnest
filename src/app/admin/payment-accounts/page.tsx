"use client";

import { useEffect, useState } from "react";
import { listAllPaymentAccounts, createPaymentAccount, updatePaymentAccount } from "@/lib/firestore/adminCatalog";
import { Icon } from "@/components/Icon";
import type { PaymentAccountDoc } from "@/types/models";

type AccountWithId = PaymentAccountDoc & { id: string };

export default function AdminPaymentAccountsPage() {
  const [accounts, setAccounts] = useState<AccountWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setAccounts(await listAllPaymentAccounts());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPaymentAccount({ bankName, accountName, accountNumber, instructions, active: true });
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      setInstructions("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: AccountWithId) {
    await updatePaymentAccount(a.id, { active: !a.active });
    await refresh();
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Payment accounts</h1>
      {error && <p className="error">{error}</p>}

      {accounts.length === 0 ? (
        <div className="empty" style={{ marginBottom: 20 }}>
          <strong>No payment accounts yet</strong>
          Add one below so customers know where to send transfers.
        </div>
      ) : (
        <div className="list-group" style={{ marginBottom: 24 }}>
          {accounts.map((a) => (
            <div key={a.id} className="list-row" style={{ cursor: "default" }}>
              <span className="list-icon"><Icon name="card" /></span>
              <span className="list-text">
                <span className="list-title">{a.bankName}</span>
                <span className="list-sub">{a.accountName} — {a.accountNumber}</span>
              </span>
              <span className={`badge ${a.active ? "ok" : ""}`} style={{ marginRight: 8 }}>
                {a.active ? "Active" : "Inactive"}
              </span>
              <button className="button secondary small" onClick={() => toggleActive(a)}>
                {a.active ? "Turn off" : "Turn on"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Add a payment account</div>
      <div className="card">
        <form onSubmit={handleCreate}>
          <input className="field" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          <input className="field" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          <input className="field" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
          <input className="field" placeholder="Instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add account"}
          </button>
        </form>
      </div>
    </main>
  );
}
