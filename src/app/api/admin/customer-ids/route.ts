import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { allocateCustomerNumber } from "@/lib/firestore/customerNumbers";

export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Only Admin may run customer ID backfill." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false;
  const db = adminDb();
  const snap = await db.collection("customerProfiles").get();
  const missing = snap.docs.filter((doc) => !doc.data().customerId);
  if (dryRun) return NextResponse.json({ dryRun: true, examined: snap.size, missing: missing.length, updated: 0 });
  let updated = 0;
  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    updated += await db.runTransaction(async (tx) => {
      let count = 0;
      for (const doc of chunk) {
        const fresh = await tx.get(doc.ref);
        if (fresh.data()?.customerId) continue;
        const orderSnap = await tx.get(db.collection("orders").where("customerId", "==", doc.id));
        const customerId = await allocateCustomerNumber(tx, db);
        tx.update(doc.ref, { customerId, updatedAt: FieldValue.serverTimestamp() });
        tx.set(db.collection("users").doc(doc.id), { customerId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        for (const order of orderSnap.docs) tx.update(order.ref, { customerNumber: customerId, updatedAt: FieldValue.serverTimestamp() });
        count++;
      }
      return count;
    });
  }
  return NextResponse.json({ dryRun: false, examined: snap.size, missing: missing.length, updated });
}
