import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { canTransition, operationalRole, serverAuditEvent } from "@/lib/firebase/operations";
import type { OrderStatus } from "@/types/models";

const customerTransitions = new Set<OrderStatus>(["Cancelled"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const caller = await verifyCaller(req);
  if (!caller) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { orderId } = await params;
  const body = await req.json().catch(() => null);
  const toStatus = body?.toStatus as OrderStatus | undefined;
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!toStatus) return NextResponse.json({ error: "toStatus is required." }, { status: 400 });

  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);
  try {
    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) throw new Error("Order not found.");
      const order = orderSnap.data()!;
      const isOwner = order.customerId === caller.uid;
      const allowed = operationalRole(caller.role) || (isOwner && customerTransitions.has(toStatus));
      if (!allowed) throw new Error("You are not permitted to transition this order.");
      const fromStatus = order.orderStatus as OrderStatus;
      if (!canTransition(fromStatus, toStatus)) throw new Error(`Invalid transition from ${fromStatus} to ${toStatus}.`);

      const historyRef = orderRef.collection("statusHistory").doc();
      tx.update(orderRef, { orderStatus: toStatus, updatedAt: FieldValue.serverTimestamp() });
      tx.set(historyRef, serverAuditEvent(caller, orderId, fromStatus, toStatus, reason));

      if (toStatus === "ReadyForDelivery") {
        const existing = await tx.get(db.collection("deliveryJobs").where("orderId", "==", orderId).limit(1));
        if (existing.empty) {
          const deliveryRef = db.collection("deliveryJobs").doc();
          tx.set(deliveryRef, {
            orderId,
            customerId: order.customerId,
            addressSnapshot: order.addressSnapshot,
            serviceAreaId: order.serviceAreaId,
            status: "Created",
            assignedRiderId: null,
            assignmentVersion: 0,
            createdBy: caller.uid,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      return { fromStatus, toStatus };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transition failed." }, { status: 400 });
  }
}
