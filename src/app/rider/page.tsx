"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyPickupJobs } from "@/lib/firestore/orders";
import { updateJobStatus } from "@/lib/firestore/jobs";
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

      {activeJobs.length === 0 && (
        <p style={{ color: "#666", fontSize: 14 }}>No active jobs right now.</p>
      )}

      {activeJobs.map((j) => (
        <div className="card" key={j.id}>
          <strong>{j.customerName as string}</strong>
          <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
            {j.address as string}
          </p>
          {j.customerPhone ? (
            <p style={{ fontSize: 13, color: "#666" }}>Phone: {j.customerPhone as string}</p>
          ) : null}
          <p style={{ fontSize: 13, color: "#1a7f4e", fontWeight: 600 }}>{j.jobStatus as string}</p>
          {NEXT_STATUS[j.jobStatus as JobStatus] && (
            <button
              className="button"
              style={{ fontSize: 13, padding: 10 }}
              disabled={busyId === j.id}
              onClick={() => advance(j.id, j.jobStatus as JobStatus)}
            >
              {busyId === j.id ? "Updating…" : `Mark as ${NEXT_STATUS[j.jobStatus as JobStatus]}`}
            </button>
          )}
        </div>
      ))}

      <button className="button" style={{ background: "#999", marginTop: 16 }} onClick={() => signOut(auth)}>
        Log out
      </button>
    </main>
  );
}
