"use client";

import { useEffect, useState } from "react";
import { listAllRiders, updateRider } from "@/lib/firestore/adminCatalog";
import { listAllServiceAreas } from "@/lib/firestore/adminCatalog";
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
    const next = current.includes(areaId)
      ? current.filter((id) => id !== areaId)
      : [...current, areaId];
    await updateRider(r.id, { serviceAreaIds: next });
    await refresh();
  }

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>Riders</h1>
      {riders.length === 0 && (
        <p style={{ color: "#666", fontSize: 14 }}>
          No rider accounts yet — provision one from{" "}
          <a href="/admin/staff">Provision staff account</a>.
        </p>
      )}
      {riders.map((r) => (
        <div className="card" key={r.id}>
          <strong>{r.name}</strong>{" "}
          <span style={{ fontSize: 12, color: r.active ? "#1a7f4e" : "#999" }}>
            {r.active ? "Active" : "Inactive"}
          </span>
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            Current workload: {r.currentWorkload ?? 0}
          </p>
          <button
            className="button"
            style={{ background: r.active ? "#b00020" : "#1a7f4e", fontSize: 13, padding: 8, marginBottom: 8 }}
            onClick={() => toggleActive(r)}
          >
            {r.active ? "Deactivate" : "Activate"}
          </button>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Service areas:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {areas.map((a) => {
              const assigned = (r.serviceAreaIds ?? []).includes(a.id);
              return (
                <button
                  key={a.id}
                  className="button"
                  style={{
                    background: assigned ? "#1a7f4e" : "#ccc",
                    color: assigned ? "#fff" : "#333",
                    fontSize: 12,
                    padding: "6px 10px",
                    width: "auto",
                  }}
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
