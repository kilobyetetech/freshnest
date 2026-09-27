"use client";

import { useEffect, useState } from "react";
import { listAllServiceAreas, createServiceArea, updateServiceArea } from "@/lib/firestore/adminCatalog";
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

      {areas.map((a) => (
        <div className="card" key={a.id}>
          <strong>{a.name}</strong>{" "}
          <span style={{ fontSize: 12, color: a.active ? "#1a7f4e" : "#999" }}>
            {a.active ? "Active" : "Inactive"}
          </span>
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            Pickup ₦{a.pickupFee} — Delivery ₦{a.deliveryFee} — Min order ₦{a.minOrder}
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

      <h2 style={{ marginTop: 24 }}>Add a service area</h2>
      <form onSubmit={handleCreate}>
        <input
          className="field"
          placeholder="Name (e.g. Lekki Phase 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="field"
          type="number"
          placeholder="Pickup fee (₦)"
          value={pickupFee}
          onChange={(e) => setPickupFee(e.target.value)}
        />
        <input
          className="field"
          type="number"
          placeholder="Delivery fee (₦)"
          value={deliveryFee}
          onChange={(e) => setDeliveryFee(e.target.value)}
        />
        <input
          className="field"
          type="number"
          placeholder="Minimum order (₦)"
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
        />
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add service area"}
        </button>
      </form>
    </main>
  );
}
