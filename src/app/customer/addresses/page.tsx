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
import { Icon } from "@/components/Icon";
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
    const active = areaList.filter((a) => a.active);
    setAreas(active);
    if (active.length && !serviceAreaId) setServiceAreaId(active[0].id);
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
      if (defaultId === addressId) await setDefaultAddress(user.uid, null);
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

      {addresses.length === 0 ? (
        <div className="empty" style={{ marginBottom: 20 }}>
          <strong>No addresses yet</strong>
          Add one below so we know where to pick up and drop off.
        </div>
      ) : (
        <div className="list-group" style={{ marginBottom: 24 }}>
          {addresses.map((a) => (
            <div key={a.id} className="list-row" style={{ cursor: "default", flexWrap: "wrap" }}>
              <span className="list-icon"><Icon name="pin" /></span>
              <span className="list-text">
                <span className="list-title">
                  {a.label} {defaultId === a.id && <span className="badge accent" style={{ marginLeft: 6 }}>Default</span>}
                </span>
                <span className="list-sub">{a.line1}, {a.city}</span>
                {!a.serviceAreaId && (
                  <span className="list-sub" style={{ color: "var(--danger)" }}>No service area — can&rsquo;t be used to order</span>
                )}
              </span>
              <div className="actions" style={{ marginTop: 0 }}>
                {defaultId !== a.id && (
                  <button className="button secondary small" onClick={() => handleSetDefault(a.id)}>Default</button>
                )}
                <button className="button danger small" onClick={() => handleDelete(a.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Add an address</div>
      <div className="card">
        <form onSubmit={handleAdd}>
          <input className="field" placeholder="Label (e.g. Home)" value={label} onChange={(e) => setLabel(e.target.value)} required />
          <input className="field" placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} required />
          <input className="field" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required />
          {areas.length > 0 ? (
            <select className="field" value={serviceAreaId} onChange={(e) => setServiceAreaId(e.target.value)}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              No service areas are set up yet — an Admin needs to add one before addresses can be used for ordering.
            </p>
          )}
          <button className="button" type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add address"}
          </button>
        </form>
      </div>
    </main>
  );
}
