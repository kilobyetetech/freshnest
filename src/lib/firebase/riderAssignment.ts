import { Firestore, FieldValue, Transaction } from "firebase-admin/firestore";
import type { RiderDoc } from "@/types/models";

const ACCEPT_WINDOW_MINUTES = 10;

/**
 * Scores and assigns the best available rider for a service area, inside
 * an already-open transaction (the caller -- verifyPayment -- owns the
 * transaction so this and the order/payment writes are atomic together).
 *
 * Algorithm (architecture Section 16, V1 -- no routing/mapping API):
 *   1. Filter: active, serviceAreaIds contains the job's area.
 *   2. Score: lowest currentWorkload first, tie-break by
 *      lastAssignedAt ascending (fairness).
 *   3. Increment the chosen rider's workload and set lastAssignedAt,
 *      inside the same transaction, to close the race condition between
 *      two jobs being assigned at nearly the same moment.
 *
 * Returns the chosen rider's uid, or null if no eligible rider exists
 * (the job is still created either way, just left unassigned --
 * Created/Assigned distinction still applies, see the caller).
 */
export async function assignRiderInTransaction(
  db: Firestore,
  tx: Transaction,
  serviceAreaId: string
): Promise<string | null> {
  // Reads inside a transaction must happen before any writes in that
  // transaction; the caller is responsible for ordering this call before
  // its own writes.
  const ridersSnap = await tx.get(
    db.collection("riders").where("active", "==", true).where("serviceAreaIds", "array-contains", serviceAreaId)
  );

  if (ridersSnap.empty) return null;

  let best: { id: string; data: RiderDoc } | null = null;
  for (const doc of ridersSnap.docs) {
    const data = doc.data() as RiderDoc;
    if (!best) {
      best = { id: doc.id, data };
      continue;
    }
    if (data.currentWorkload < best.data.currentWorkload) {
      best = { id: doc.id, data };
    } else if (data.currentWorkload === best.data.currentWorkload) {
      const bestLast = toMillis(best.data.lastAssignedAt);
      const dataLast = toMillis(data.lastAssignedAt);
      if (dataLast < bestLast) {
        best = { id: doc.id, data };
      }
    }
  }

  if (!best) return null;

  tx.update(db.collection("riders").doc(best.id), {
    currentWorkload: FieldValue.increment(1),
    lastAssignedAt: FieldValue.serverTimestamp(),
  });

  return best.id;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

export function acceptDeadlineFromNow(): Date {
  return new Date(Date.now() + ACCEPT_WINDOW_MINUTES * 60 * 1000);
}
