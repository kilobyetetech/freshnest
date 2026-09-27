import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { logAudit } from "@/lib/firebase/auditServer";
import { acceptDeadlineFromNow } from "@/lib/firebase/riderAssignment";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Admin-only. Moves a pickup job to a different rider, decrementing the
 * old rider's workload and incrementing the new one's in the same
 * transaction as the job update -- this is what keeps workload counters
 * correct through repeated reassignment (Phase 2 completion report
 * check #3).
 */
export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Only Admin may reassign a job." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const jobId: string | undefined = body?.jobId;
  const newRiderId: string | undefined = body?.newRiderId;
  if (!jobId || !newRiderId) {
    return NextResponse.json({ error: "jobId and newRiderId are required." }, { status: 400 });
  }

  const db = adminDb();
  const jobRef = db.collection("pickupJobs").doc(jobId);
  const newRiderRef = db.collection("riders").doc(newRiderId);

  try {
    await db.runTransaction(async (tx) => {
      const jobSnap = await tx.get(jobRef);
      if (!jobSnap.exists) throw new Error("Job not found.");
      const job = jobSnap.data()!;

      const newRiderSnap = await tx.get(newRiderRef);
      if (!newRiderSnap.exists || !newRiderSnap.data()!.active) {
        throw new Error("New rider is not active or does not exist.");
      }

      if (job.riderId) {
        tx.update(db.collection("riders").doc(job.riderId), {
          currentWorkload: FieldValue.increment(-1),
        });
      }
      tx.update(newRiderRef, {
        currentWorkload: FieldValue.increment(1),
        lastAssignedAt: FieldValue.serverTimestamp(),
      });

      tx.update(jobRef, {
        riderId: newRiderId,
        jobStatus: "Assigned",
        assignedAt: FieldValue.serverTimestamp(),
        acceptDeadline: acceptDeadlineFromNow(),
        acceptedAt: null,
        enRouteAt: null,
        arrivedAt: null,
      });
    });

    await logAudit(db, {
      actorId: caller.uid,
      actorRole: "admin",
      action: "reassignPickupJob.success",
      resource: "pickupJobs",
      resourceId: jobId,
      previousState: null,
      newState: { newRiderId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not reassign job." },
      { status: 400 }
    );
  }
}
