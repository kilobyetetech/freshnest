import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { computePricingSnapshot, OrderItemInput } from "@/lib/firebase/pricing";
import { logAudit } from "@/lib/firebase/auditServer";
import { FieldValue } from "firebase-admin/firestore";

interface CreateOrderBody {
  items: OrderItemInput[];
  addressId: string;
  promotionCode?: string;
}

/**
 * Customer-only. The client sends ONLY serviceId/quantity/weight,
 * addressId, and an optional promotion code -- never a price or amount.
 * This route is the sole place an order's pricingSnapshot is computed;
 * it is written once here and never modified by any later Function/route.
 */
export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "customer") {
    return NextResponse.json({ error: "Only a signed-in customer may create an order." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
  if (!body?.items?.length || !body.addressId) {
    return NextResponse.json({ error: "items and addressId are required." }, { status: 400 });
  }

  const db = adminDb();

  const addressSnap = await db.collection("addresses").doc(body.addressId).get();
  if (!addressSnap.exists) {
    return NextResponse.json({ error: "Address not found." }, { status: 404 });
  }
  const address = addressSnap.data()!;
  if (address.customerId !== caller.uid) {
    return NextResponse.json({ error: "That address does not belong to you." }, { status: 403 });
  }
  const serviceAreaId = address.serviceAreaId;
  if (!serviceAreaId) {
    return NextResponse.json(
      { error: "This address is not linked to a service area yet." },
      { status: 400 }
    );
  }

  let pricingSnapshot;
  try {
    pricingSnapshot = await computePricingSnapshot(db, body.items, serviceAreaId, body.promotionCode, caller.uid);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not price this order." },
      { status: 400 }
    );
  }

  const userSnap = await db.collection("users").doc(caller.uid).get();
  const user = userSnap.data();

  const orderRef = db.collection("orders").doc();

  await db.runTransaction(async (tx) => {
    if (pricingSnapshot.promotionCode) {
      const promoQuery = await tx.get(db.collection("promotions").where("code", "==", pricingSnapshot.promotionCode).limit(1));
      if (promoQuery.empty) throw new Error("Promotion is no longer available.");
      const promoRef = promoQuery.docs[0].ref;
      const promo = promoQuery.docs[0].data();
      const redemptionRef = db.collection("promotionRedemptions").doc(`${promoRef.id}_${caller.uid}_${orderRef.id}`);
      const redemptionSnap = await tx.get(redemptionRef);
      if (redemptionSnap.exists) throw new Error("This promotion has already been redeemed for this order.");
      if (promo.usageLimit && (promo.usageCount ?? 0) >= promo.usageLimit) throw new Error("This promotion has reached its usage limit.");
      tx.update(promoRef, { usageCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      tx.set(redemptionRef, { promotionId: promoRef.id, code: pricingSnapshot.promotionCode, customerId: caller.uid, orderId: orderRef.id, createdAt: FieldValue.serverTimestamp() });
    }

    tx.set(orderRef, {
      customerId: caller.uid,
      customerName: user?.displayName ?? "",
      customerPhone: user?.phone ?? null,
      addressId: body.addressId,
      addressSnapshot: address,
      serviceAreaId,
      orderStatus: "Pending",
      paymentStatus: "Unpaid",
      refundStatus: "None",
      pricingSnapshot: { ...pricingSnapshot, calculatedAt: FieldValue.serverTimestamp() },
      paymentMethod: "transfer",
      paymentId: null,
      assignedPickupJobId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(orderRef.collection("statusHistory").doc(), {
      previousStatus: null,
      newStatus: "Pending",
      actorId: caller.uid,
      actorRole: "customer",
      note: "Order created",
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  await logAudit(db, {
    actorId: caller.uid,
    actorRole: "customer",
    action: "createOrder.success",
    resource: "orders",
    resourceId: orderRef.id,
    previousState: null,
    newState: { total: pricingSnapshot.total },
  });

  return NextResponse.json({ orderId: orderRef.id, pricingSnapshot });
}
