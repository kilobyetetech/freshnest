"use client";

import { useEffect, useState } from "react";
import { listAllRiders, updateRider, listAllServiceAreas } from "@/lib/firestore/adminCatalog";
import { Icon } from "@/components/Icon";
import type { RiderDoc, ServiceAreaDoc } from "@/types/models";

type RiderWithId = RiderDoc & { id: string };

export default function AdminRidersPage() {
  const [riders, setRiders] = useState<RiderWithId[]>([]);
  const [areas, setAreas] = useState<Array<ServiceAreaDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const [r, a] = await Promise.all([listAllRiders(), listAllServiceAreas()]);
    setRiders(r);
    setAreas(a);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleActive(r: RiderWithId) {
    await updateRider(r.id, { active: !r.active });
    await refresh();
  }

  async function toggleArea(r: RiderWithId, areaId: string) {
    const current = r.serviceAreaIds ?? [];
    const next = current.includes(areaId) ? current.filter((id) => id !== areaId) : [...current, areaId];
    await updateRider(r.id, { serviceAreaIds: next });
    await refresh();
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Riders</h1>
      {riders.length === 0 && (
        <div className="empty">
          <strong>No riders yet</strong>
          Provision one from <a href="/admin/staff">Provision staff account</a>.
        </div>
      )}
      {riders.map((r) => (
        <div className="card" key={r.id}>
          <div className="row-between" style={{ marginBottom: 4 }}>
            <strong>{r.name}</strong>
            <span className={`badge ${r.active ? "ok" : ""}`}>{r.active ? "Active" : "Inactive"}</span>
          </div>
          <p className="muted" style={{ fontSize: "0.88rem", margin: "0 0 10px" }}>
            Current workload: {r.currentWorkload ?? 0}
          </p>
          <button className="button secondary small" style={{ marginBottom: 12 }} onClick={() => toggleActive(r)}>
            {r.active ? "Deactivate" : "Activate"}
          </button>
          <p className="muted" style={{ fontSize: "0.82rem", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="pin" size={14} /> Service areas
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {areas.map((a) => {
              const assigned = (r.serviceAreaIds ?? []).includes(a.id);
              return (
                <button
                  key={a.id}
                  className={`badge ${assigned ? "accent" : ""}`}
                  style={{ border: "none", cursor: "pointer" }}
                  onClick={() => toggleArea(r, a.id)}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </main>
  );
}
