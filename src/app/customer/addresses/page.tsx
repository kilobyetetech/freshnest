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
import { listServiceAreas } from "@/lib/firestore/catalog";
import type { AddressDoc, ServiceAreaDoc } from "@/types/models";

type AddressWithId = AddressDoc & { id: string };

export default function AddressesPage() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<AddressWithId[]>([]);
  const [areas, setAreas] = useState<Array<ServiceAreaDoc & { id: string }>>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [serviceAreaId, setServiceAreaId] = useState("");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    if (!user) return;
    const [list, profile, areaList] = await Promise.all([
      listMyAddresses(user.uid),
      getCustomerProfile(user.uid),
      listServiceAreas(),
    ]);
    setAddresses(list);
    setDefaultId(profile?.defaultAddressId ?? null);
    setAreas(areaList.filter((a) => a.active));
    if (areaList.length && !serviceAreaId) setServiceAreaId(areaList[0].id);
    setLoading(false);
  }

  useEffect(() => {
    if (user) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setAdding(true);
    setError(null);
    try {
      await createAddress(user.uid, { label, line1, city, serviceAreaId: serviceAreaId || null });
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
          {!a.serviceAreaId && (
            <p style={{ fontSize: 12, color: "#b00020" }}>
              No service area set — this address can&rsquo;t be used to place an order yet.
            </p>
          )}
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
        {areas.length > 0 ? (
          <select
            className="field"
            value={serviceAreaId}
            onChange={(e) => setServiceAreaId(e.target.value)}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <p style={{ fontSize: 13, color: "#b00020" }}>
            No service areas are set up yet — an Admin needs to add one before addresses can be
            used for ordering.
          </p>
        )}
        <button className="button" type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add address"}
        </button>
      </form>
    </main>
  );
}
