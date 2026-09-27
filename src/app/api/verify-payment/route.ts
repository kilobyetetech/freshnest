import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { logAudit } from "@/lib/firebase/auditServer";
import { assignRiderInTransaction, acceptDeadlineFromNow } from "@/lib/firebase/riderAssignment";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Finance/Admin only. This single route performs the entire chain the
 * architecture describes as "payment confirmed -> order confirmed ->
 * pickup job created -> rider auto-assigned", all inside one Firestore
 * transaction -- see the Phase 2 prompt's infrastructure note for why
 * this is one synchronous route rather than a Function trigger.
 *
 * Idempotency: the transaction re-reads payment.status and rejects if it
 * isn't still "pending_verification", which is what actually prevents
 * double-confirmation under concurrent/duplicate requests -- the check
 * and the write happen inside the same transaction, closing the race
 * window a separate read-then-write would leave open.
 */
export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || (caller.role !== "finance" && caller.role !== "admin")) {
    return NextResponse.json({ error: "Only Finance or Admin may verify payments." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const paymentId: string | undefined = body?.paymentId;
  const decision: "confirm" | "reject" | undefined = body?.decision;
  const rejectionReason: string | undefined = body?.rejectionReason;

  if (!paymentId || (decision !== "confirm" && decision !== "reject")) {
    return NextResponse.json({ error: "paymentId and decision ('confirm'|'reject') are required." }, { status: 400 });
  }
  if (decision === "reject" && !rejectionReason) {
    return NextResponse.json({ error: "rejectionReason is required when rejecting." }, { status: 400 });
  }

  const db = adminDb();
  const paymentRef = db.collection("payments").doc(paymentId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentRef);
      if (!paymentSnap.exists) throw new Error("Payment not found.");
      const payment = paymentSnap.data()!;

      // Idempotency guard -- the whole point of doing this inside the
      // transaction rather than as a separate check beforehand.
      if (payment.status !== "pending_verification") {
        throw new Error(`This payment has already been processed (status: ${payment.status}).`);
      }

      const orderRef = db.collection("orders").doc(payment.orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error("Associated order not found.");
      const order = orderSnap.data()!;

      if (decision === "reject") {
        tx.update(paymentRef, {
          status: "rejected",
          verifiedBy: caller.uid,
          verifiedAt: FieldValue.serverTimestamp(),
          rejectionReason,
        });
        tx.update(orderRef, {
          paymentStatus: "Rejected",
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { decision: "reject" as const };
      }

      // decision === "confirm"
      // Rider assignment reads must happen before any writes in this
      // transaction (Firestore transaction rule: all reads first).
      const riderId = await assignRiderInTransaction(db, tx, order.serviceAreaId);

      tx.update(paymentRef, {
        status: "confirmed",
        verifiedBy: caller.uid,
        verifiedAt: FieldValue.serverTimestamp(),
      });

      const nextOrderStatus = order.orderStatus === "Pending" ? "Confirmed" : order.orderStatus;
      const pickupJobRef = db.collection("pickupJobs").doc(`${payment.orderId}_pickup`);

      tx.update(orderRef, {
        paymentStatus: "Confirmed",
        orderStatus: nextOrderStatus,
        assignedPickupJobId: pickupJobRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      tx.set(orderRef.collection("statusHistory").doc(), {
        previousStatus: order.orderStatus,
        newStatus: nextOrderStatus,
        actorId: caller.uid,
        actorRole: caller.role,
        note: "Payment confirmed",
        timestamp: FieldValue.serverTimestamp(),
      });

      const addressLine = order.addressSnapshot
        ? `${order.addressSnapshot.line1 ?? ""}, ${order.addressSnapshot.city ?? ""}`
        : "";

      // Deterministic, existence-checked job ID (architecture correction
      // #2): pickupJobRef.id is derived from the order ID, so retries of
      // this whole route are safe -- a second confirm attempt would have
      // already failed the idempotency guard above, and even if it
      // somehow got this far, `.set()` on this same deterministic ID
      // simply overwrites rather than duplicating.
      tx.set(pickupJobRef, {
        orderId: payment.orderId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: addressLine,
        serviceAreaId: order.serviceAreaId,
        jobType: "pickup",
        jobStatus: riderId ? "Assigned" : "Created",
        riderId: riderId ?? null,
        assignedAt: riderId ? FieldValue.serverTimestamp() : null,
        acceptDeadline: riderId ? acceptDeadlineFromNow() : null,
        acceptedAt: null,
        enRouteAt: null,
        arrivedAt: null,
        completedAt: null,
      });

      return { decision: "confirm" as const, riderId, pickupJobId: pickupJobRef.id };
    });

    await logAudit(db, {
      actorId: caller.uid,
      actorRole: caller.role ?? "unknown",
      action: `verifyPayment.${result.decision}`,
      resource: "payments",
      resourceId: paymentId,
      previousState: { status: "pending_verification" },
      newState: result,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not process this payment." },
      { status: 400 }
    );
  }
}
