"use client";

import { useEffect, useState } from "react";
import { listAllPaymentAccounts, createPaymentAccount, updatePaymentAccount } from "@/lib/firestore/adminCatalog";
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

      {accounts.map((a) => (
        <div className="card" key={a.id}>
          <strong>{a.bankName}</strong>{" "}
          <span style={{ fontSize: 12, color: a.active ? "#1a7f4e" : "#999" }}>
            {a.active ? "Active" : "Inactive"}
          </span>
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            {a.accountName} — {a.accountNumber}
          </p>
          <button
            className="button"
            style={{ background: a.active ? "#b00020" : "#1a7f4e", fontSize: 13, padding: 8 }}
            onClick={() => toggleActive(a)}
          >
            {a.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>Add a payment account</h2>
      <form onSubmit={handleCreate}>
        <input
          className="field"
          placeholder="Bank name"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Account name"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Account number"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Instructions (optional)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add account"}
        </button>
      </form>
    </main>
  );
}
