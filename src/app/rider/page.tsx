"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyPickupJobs } from "@/lib/firestore/orders";
import { updateJobStatus } from "@/lib/firestore/jobs";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import type { JobStatus } from "@/types/models";

const NEXT_STATUS: Partial<Record<JobStatus, JobStatus>> = {
  Assigned: "Accepted",
  Accepted: "EnRoute",
  EnRoute: "Arrived",
  Arrived: "Completed",
};

export default function RiderDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    setJobs(await listMyPickupJobs(user.uid));
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function advance(jobId: string, current: JobStatus) {
    const next = NEXT_STATUS[current];
    if (!next) return;
    setBusyId(jobId);
    try {
      await updateJobStatus(jobId, next);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <main className="page">Loading…</main>;

  const activeJobs = jobs.filter((j) => j.jobStatus !== "Completed");

  return (
    <main className="page">
      <h1>My pickups</h1>

      {activeJobs.length === 0 ? (
        <div className="empty">
          <strong>Nothing assigned right now</strong>
          New pickups will show up here as soon as they come in.
        </div>
      ) : (
        activeJobs.map((j) => (
          <div className="card" key={j.id}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <strong>{j.customerName as string}</strong>
              <StatusBadge status={j.jobStatus as string} />
            </div>
            <p className="muted" style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
              <Icon name="pin" size={16} /> {j.address as string}
            </p>
            {j.customerPhone ? (
              <p className="muted" style={{ fontSize: "0.85rem" }}>Phone: {j.customerPhone as string}</p>
            ) : null}
            {NEXT_STATUS[j.jobStatus as JobStatus] && (
              <button
                className="button"
                style={{ marginTop: 10 }}
                disabled={busyId === j.id}
                onClick={() => advance(j.id, j.jobStatus as JobStatus)}
              >
                {busyId === j.id ? "Updating…" : `Mark as ${NEXT_STATUS[j.jobStatus as JobStatus]}`}
              </button>
            )}
          </div>
        ))
      )}
    </main>
  );
}
