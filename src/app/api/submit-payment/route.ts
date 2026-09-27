import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Customer-only. Accepts a transaction reference ONLY -- no receipt image
 * upload, since Storage is still unavailable pending Blaze (see Phase 2
 * prompt's Storage substitution note). This is a documented, temporary
 * gap, not a silent one.
 */
export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "customer") {
    return NextResponse.json({ error: "Only a signed-in customer may submit payment." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const orderId: string | undefined = body?.orderId;
  const transactionReference: string | undefined = body?.transactionReference;

  if (!orderId || !transactionReference) {
    return NextResponse.json({ error: "orderId and transactionReference are required." }, { status: 400 });
  }

  const db = adminDb();
  const orderRef = db.collection("orders").doc(orderId);

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error("Order not found.");
      }
      const order = orderSnap.data()!;
      if (order.customerId !== caller.uid) {
        throw new Error("That order does not belong to you.");
      }
      if (order.paymentStatus !== "Unpaid" && order.paymentStatus !== "Rejected") {
        throw new Error(`Cannot submit payment while status is ${order.paymentStatus}.`);
      }

      const paymentRef = db.collection("payments").doc();
      tx.set(paymentRef, {
        orderId,
        customerId: caller.uid,
        amountExpected: order.pricingSnapshot.total,
        transactionReference,
        status: "pending_verification",
        verifiedBy: null,
        verifiedAt: null,
        rejectionReason: null,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(orderRef, {
        paymentStatus: "PendingVerification",
        paymentId: paymentRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { paymentId: paymentRef.id };
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not submit payment." },
      { status: 400 }
    );
  }
}
