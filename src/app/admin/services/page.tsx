"use client";

import { useEffect, useState } from "react";
import { listAllServices, createService, updateService } from "@/lib/firestore/adminCatalog";
import type { ServiceDoc, PricingModel } from "@/types/models";

type ServiceWithId = ServiceDoc & { id: string };

export default function AdminServicesPage() {
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [pricingModel, setPricingModel] = useState<PricingModel>("per_item");
  const [unitPrice, setUnitPrice] = useState("");
  const [minOrder, setMinOrder] = useState("0");
  const [turnaroundHours, setTurnaroundHours] = useState("24");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setServices(await listAllServices());
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
      await createService({
        name,
        pricingModel,
        unitPrice: Number(unitPrice),
        minOrder: Number(minOrder),
        turnaroundHours: Number(turnaroundHours),
        active: true,
      });
      setName("");
      setUnitPrice("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create service.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: ServiceWithId) {
    await updateService(s.id, { active: !s.active });
    await refresh();
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Services & pricing</h1>
      {error && <p className="error">{error}</p>}

      {services.map((s) => (
        <div className="card" key={s.id}>
          <strong>{s.name}</strong>{" "}
          <span style={{ fontSize: 12, color: s.active ? "#1a7f4e" : "#999" }}>
            {s.active ? "Active" : "Inactive"}
          </span>
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            {s.pricingModel} — ₦{s.unitPrice} — min order ₦{s.minOrder} — {s.turnaroundHours}h turnaround
          </p>
          <button
            className="button"
            style={{ background: s.active ? "#b00020" : "#1a7f4e", fontSize: 13, padding: 8 }}
            onClick={() => toggleActive(s)}
          >
            {s.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>Add a service</h2>
      <form onSubmit={handleCreate}>
        <input
          className="field"
          placeholder="Name (e.g. Shirt wash)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select
          className="field"
          value={pricingModel}
          onChange={(e) => setPricingModel(e.target.value as PricingModel)}
        >
          <option value="per_item">Per item</option>
          <option value="per_kg">Per kg</option>
          <option value="flat">Flat rate</option>
          <option value="custom_quote">Custom quote</option>
        </select>
        <input
          className="field"
          type="number"
          placeholder="Unit price (₦)"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />
        <input
          className="field"
          type="number"
          placeholder="Minimum order (₦)"
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
        />
        <input
          className="field"
          type="number"
          placeholder="Turnaround (hours)"
          value={turnaroundHours}
          onChange={(e) => setTurnaroundHours(e.target.value)}
        />
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add service"}
        </button>
      </form>
    </main>
  );
}
