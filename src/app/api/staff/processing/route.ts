import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";

const PROCESSING_STATUSES = ["Received", "Sorting", "Washing", "Drying", "IroningFolding", "QualityCheck"] as const;

export async function GET(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || !["admin", "staff"].includes(caller.role ?? "")) {
    return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  }
  const requested = new URL(req.url).searchParams.get("status");
  const statuses = requested && PROCESSING_STATUSES.includes(requested as typeof PROCESSING_STATUSES[number])
    ? [requested]
    : PROCESSING_STATUSES;
  const db = adminDb();
  const snapshots = await Promise.all(statuses.map((status) => db.collection("orders").where("orderStatus", "==", status).limit(100).get()));
  const orders = snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => ({
    id: doc.id,
    orderNumber: doc.data().orderNumber ?? null,
    customerId: doc.data().customerNumber ?? null,
    orderStatus: doc.data().orderStatus,
    pricingSnapshot: doc.data().pricingSnapshot ?? null,
    intakeNotes: doc.data().intakeNotes ?? null,
    qualityControl: doc.data().qualityControl ?? null,
  })));
  return NextResponse.json({ orders });
}
