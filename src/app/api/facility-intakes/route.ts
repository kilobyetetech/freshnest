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
  if (!body || typeof body.orderId !== "string" || typeof body.pickupJobId !== "string") {
    return NextResponse.json({ error: "orderId and pickupJobId are required." }, { status: 400 });
  }
  const integerField = (value: unknown, min: number) => {
    if (value === undefined) return undefined;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) return null;
    return value;
  };
  const packageCountValue = integerField(body.packageCount, 1);
  const observedItemCount = integerField(body.observedItemCount, 0);
  if (packageCountValue === null || observedItemCount === null) {
    return NextResponse.json({ error: "packageCount and observedItemCount must be valid non-negative integers." }, { status: 400 });
  }
  const packageCount = packageCountValue ?? 1;
  const weight = body.weight === undefined ? undefined : body.weight;
  if (weight !== undefined && (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0)) {
    return NextResponse.json({ error: "weight must be a non-negative finite number." }, { status: 400 });
  }
  if (body.weightUnit !== undefined && body.weightUnit !== "kg" && body.weightUnit !== "lb") {
    return NextResponse.json({ error: "weightUnit must be kg or lb." }, { status: 400 });
  }
  const conditionNotes = body.conditionNotes === undefined ? "" : body.conditionNotes;
  if (typeof conditionNotes !== "string" || conditionNotes.length > 1000) return NextResponse.json({ error: "conditionNotes is invalid." }, { status: 400 });
  const db = adminDb();
  const intakeRef = db.collection("facilityIntakes").doc();
  const orderRef = db.collection("orders").doc(body.orderId);
  try {
    await db.runTransaction(async (tx) => {
      const order = await tx.get(orderRef);
      if (!order.exists) throw new Error("Order not found.");
      if (!["PickedUp", "Received"].includes(order.data()?.orderStatus)) throw new Error("Order is not ready for facility intake.");
      const pickupJobRef = db.collection("pickupJobs").doc(body.pickupJobId);
      const pickupJob = await tx.get(pickupJobRef);
      if (!pickupJob.exists || pickupJob.data()?.orderId !== body.orderId || pickupJob.data()?.jobStatus !== "Completed") {
        throw new Error("Pickup job is not completed for this order.");
      }
      const existingIntake = await tx.get(db.collection("facilityIntakes").where("orderId", "==", body.orderId).limit(1));
      if (!existingIntake.empty) throw new Error("Facility intake already exists for this order.");
      tx.set(intakeRef, {
        id: intakeRef.id,
        orderId: body.orderId,
        pickupJobId: body.pickupJobId,
        receivedByUid: caller.uid,
        receivedAt: FieldValue.serverTimestamp(),
        packageCount,
        observedItemCount: observedItemCount ?? null,
        conditionNotes,
        weight: weight ?? null,
        weightUnit: body.weightUnit ?? "kg",
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
