"use client";

import { useEffect, useState } from "react";
import { listAllServices, createService, updateService } from "@/lib/firestore/adminCatalog";
import { Icon } from "@/components/Icon";
import type { ServiceDoc, PricingModel } from "@/types/models";

type ServiceWithId = ServiceDoc & { id: string };

const MODEL_LABEL: Record<PricingModel, string> = {
  per_item: "/item",
  per_kg: "/kg",
  flat: "flat",
  custom_quote: "custom quote",
};

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

      {services.length === 0 ? (
        <div className="empty" style={{ marginBottom: 20 }}>
          <strong>No services yet</strong>
          Add your first one below — customers can only order active services.
        </div>
      ) : (
        <div className="list-group" style={{ marginBottom: 24 }}>
          {services.map((s) => (
            <div key={s.id} className="list-row" style={{ cursor: "default" }}>
              <span className="list-icon"><Icon name="tag" /></span>
              <span className="list-text">
                <span className="list-title">{s.name}</span>
                <span className="list-sub">
                  ₦{s.unitPrice} {MODEL_LABEL[s.pricingModel]} · min ₦{s.minOrder} · {s.turnaroundHours}h
                </span>
              </span>
              <span className={`badge ${s.active ? "ok" : ""}`} style={{ marginRight: 8 }}>
                {s.active ? "Active" : "Inactive"}
              </span>
              <button className="button secondary small" onClick={() => toggleActive(s)}>
                {s.active ? "Turn off" : "Turn on"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">Add a service</div>
      <div className="card">
        <form onSubmit={handleCreate}>
          <input className="field" placeholder="Name (e.g. Shirt wash)" value={name} onChange={(e) => setName(e.target.value)} required />
          <select className="field" value={pricingModel} onChange={(e) => setPricingModel(e.target.value as PricingModel)}>
            <option value="per_item">Per item</option>
            <option value="per_kg">Per kg</option>
            <option value="flat">Flat rate</option>
            <option value="custom_quote">Custom quote</option>
          </select>
          <input className="field" type="number" placeholder="Unit price (₦)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
          <input className="field" type="number" placeholder="Minimum order (₦)" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          <input className="field" type="number" placeholder="Turnaround (hours)" value={turnaroundHours} onChange={(e) => setTurnaroundHours(e.target.value)} />
          <button className="button" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add service"}
          </button>
        </form>
      </div>
    </main>
  );
}
