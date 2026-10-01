"use client";

import { useEffect, useState } from "react";
import { listAllServiceAreas, createServiceArea, updateServiceArea } from "@/lib/firestore/adminCatalog";
import { Icon } from "@/components/Icon";
import type { ServiceAreaDoc } from "@/types/models";

type AreaWithId = ServiceAreaDoc & { id: string };

export default function AdminServiceAreasPage() {
  const [areas, setAreas] = useState<AreaWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [pickupFee, setPickupFee] = useState("0");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [minOrder, setMinOrder] = useState("0");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setAreas(await listAllServiceAreas());
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
      await createServiceArea({
        name,
        pickupAvailable: true,
        deliveryAvailable: true,
        pickupFee: Number(pickupFee),
        deliveryFee: Number(deliveryFee),
        minOrder: Number(minOrder),
        operatingDays: ["MO", "TU", "WE", "TH", "FR", "SA"],
        assignedRiderIds: [],
        active: true,
      });
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service area.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: AreaWithId) {
    await updateServiceArea(a.id, { active: !a.active });
    await refresh();
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Service areas</h1>
      {error && <p className="error">{error}</p>}

      {areas.length === 0 ? (
        <div className="empty" style={{ marginBottom: 20 }}>
          <strong>No service areas yet</strong>
          Add one below — customers need a service area on their address before they can order.
        </div>
      ) : (
        <div className="list-group" style={{ marginBottom: 24 }}>
          {areas.map((a) => (
            <div key={a.id} className="list-row" style={{ cursor: "default" }}>
              <span className="list-icon"><Icon name="pin" /></span>
              <span className="list-text">
                <span className="list-title">{a.name}</span>
                <span className="list-sub">Pickup ₦{a.pickupFee} · Delivery ₦{a.deliveryFee} · min ₦{a.minOrder}</span>
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

      <div className="section-title">Add a service area</div>
      <div className="card">
        <form onSubmit={handleCreate}>
          <input className="field" placeholder="Name (e.g. Lekki Phase 1)" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="field" type="number" placeholder="Pickup fee (₦)" value={pickupFee} onChange={(e) => setPickupFee(e.target.value)} />
          <input className="field" type="number" placeholder="Delivery fee (₦)" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          <input className="field" type="number" placeholder="Minimum order (₦)" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add service area"}
          </button>
        </form>
      </div>
    </main>
  );
}
