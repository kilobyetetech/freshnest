import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";

export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || !["admin", "staff"].includes(caller.role ?? "")) {
    return NextResponse.json({ error: "Staff authorization required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.orderId || !body?.pickupJobId) return NextResponse.json({ error: "orderId and pickupJobId are required." }, { status: 400 });
  const db = adminDb();
  const intakeRef = db.collection("facilityIntakes").doc();
  const orderRef = db.collection("orders").doc(body.orderId);
  try {
    await db.runTransaction(async (tx) => {
      const order = await tx.get(orderRef);
      if (!order.exists) throw new Error("Order not found.");
      if (!["PickedUp", "Received"].includes(order.data()?.orderStatus)) throw new Error("Order is not ready for facility intake.");
      tx.set(intakeRef, {
        id: intakeRef.id,
        orderId: body.orderId,
        pickupJobId: body.pickupJobId,
        receivedByUid: caller.uid,
        receivedAt: FieldValue.serverTimestamp(),
        packageCount: Number.isInteger(body.packageCount) && body.packageCount > 0 ? body.packageCount : 1,
        observedItemCount: typeof body.observedItemCount === "number" ? body.observedItemCount : null,
        conditionNotes: typeof body.conditionNotes === "string" ? body.conditionNotes.slice(0, 1000) : "",
        weight: typeof body.weight === "number" && body.weight >= 0 ? body.weight : null,
        weightUnit: body.weightUnit === "lb" ? "lb" : "kg",
        photos: [],
        exceptions: [],
        status: "Received",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const historyRef = orderRef.collection("statusHistory").doc();
      tx.update(orderRef, { orderStatus: "Received", updatedAt: FieldValue.serverTimestamp() });
      tx.set(historyRef, { orderId: body.orderId, fromStatus: order.data()?.orderStatus, toStatus: "Received", changedByUid: caller.uid, changedByRole: caller.role, timestamp: FieldValue.serverTimestamp(), reason: "Facility intake", source: "vercel-api" });
    });
    return NextResponse.json({ ok: true, intakeId: intakeRef.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create intake." }, { status: 400 });
  }
}
