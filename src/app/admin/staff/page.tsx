"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase/client";

type StaffRole = "admin" | "finance" | "staff" | "rider";

export default function ProvisionStaffPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ uid: string; role: StaffRole } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/provision-staff-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email,
          phone: phone || undefined,
          displayName,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Provisioning failed.");
      }
      setResult(data);
      setEmail("");
      setPhone("");
      setDisplayName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provisioning failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Provision staff account</h1>
      {error && <p className="error">{error}</p>}
      {result && (
        <p style={{ color: "#1a7f4e", fontSize: 14 }}>
          Created {result.role} account (uid: {result.uid}).
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <input
          className="field"
          type="text"
          placeholder="Full name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
        <input
          className="field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="field"
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select
          className="field"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
        >
          <option value="staff">Staff</option>
          <option value="finance">Finance</option>
          <option value="rider">Rider</option>
          <option value="admin">Admin</option>
        </select>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Provisioning…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
