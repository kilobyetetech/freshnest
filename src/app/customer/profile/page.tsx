"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getCustomerProfile, updateCustomerProfile } from "@/lib/firestore/profile";
import type { CustomerProfileDoc } from "@/types/models";

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfileDoc | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getCustomerProfile(user.uid).then((p) => {
      setProfile(p);
      setName(p?.name ?? "");
      setPhone(p?.phone ?? "");
      setLoading(false);
    });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await updateCustomerProfile(user.uid, { name, phone });
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>My profile</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <form onSubmit={handleSave}>
          <label>Name</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Phone</label>
          <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <label>Email</label>
          <input className="field" value={profile?.email ?? ""} disabled />
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {savedAt && <p className="badge ok" style={{ marginTop: 10 }}>Saved</p>}
        </form>
      </div>
    </main>
  );
}
