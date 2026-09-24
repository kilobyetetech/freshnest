"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  listMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "@/lib/firestore/addresses";
import { getCustomerProfile } from "@/lib/firestore/profile";
import type { AddressDoc } from "@/types/models";

type AddressWithId = AddressDoc & { id: string };

export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressWithId[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    if (!user) return;
    const [list, profile] = await Promise.all([
      listMyAddresses(user.uid),
      getCustomerProfile(user.uid),
    ]);
    setAddresses(list);
    setDefaultId(profile?.defaultAddressId ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (user) void refresh();
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAdding(true);
    setError(null);
    try {
      await createAddress(user.uid, { label, line1, city });
      setLabel("");
      setLine1("");
      setCity("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add address.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!user) return;
    setError(null);
    try {
      if (defaultId === addressId) {
        // Clear the default first so we never point at a deleted address.
        await setDefaultAddress(user.uid, null);
      }
      await deleteAddress(addressId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete address.");
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!user) return;
    setError(null);
    try {
      await setDefaultAddress(user.uid, addressId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set default.");
    }
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>My addresses</h1>
      {error && <p className="error">{error}</p>}

      {addresses.length === 0 && (
        <p style={{ color: "#666", fontSize: 14 }}>No addresses yet — add one below.</p>
      )}

      {addresses.map((a) => (
        <div className="card" key={a.id}>
          <strong>{a.label}</strong>
          {defaultId === a.id && (
            <span style={{ marginLeft: 8, fontSize: 12, color: "#1a7f4e" }}>Default</span>
          )}
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            {a.line1}, {a.city}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {defaultId !== a.id && (
              <button
                className="button"
                style={{ background: "#333", fontSize: 13, padding: 8 }}
                onClick={() => handleSetDefault(a.id)}
              >
                Set as default
              </button>
            )}
            <button
              className="button"
              style={{ background: "#b00020", fontSize: 13, padding: 8 }}
              onClick={() => handleDelete(a.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>Add an address</h2>
      <form onSubmit={handleAdd}>
        <input
          className="field"
          placeholder="Label (e.g. Home)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Street address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        <button className="button" type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add address"}
        </button>
      </form>
    </main>
  );
}
