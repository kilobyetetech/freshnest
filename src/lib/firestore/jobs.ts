import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { JobStatus } from "@/types/models";

const TIMESTAMP_FIELD: Partial<Record<JobStatus, string>> = {
  Accepted: "acceptedAt",
  EnRoute: "enRouteAt",
  Arrived: "arrivedAt",
  Completed: "completedAt",
};

/**
 * Updates a pickup job's status field, plus the matching timestamp field
 * where one applies. The rules restrict a rider to changing only
 * jobStatus and these four timestamp fields on their own assigned job --
 * matching exactly what this function writes, nothing more.
 */
export async function updateJobStatus(jobId: string, newStatus: JobStatus): Promise<void> {
  const fields: Record<string, unknown> = { jobStatus: newStatus };
  const timestampField = TIMESTAMP_FIELD[newStatus];
  if (timestampField) {
    fields[timestampField] = serverTimestamp();
  }
  await updateDoc(doc(db, "pickupJobs", jobId), fields);
}
