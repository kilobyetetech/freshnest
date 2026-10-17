import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";

const allowed = new Set(["admin", "finance"]);

export async function GET(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || !allowed.has(caller.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
  const db = adminDb();
  const snap = await db.collection("orders").orderBy("createdAt", "desc").limit(pageSize).get();
  const orders = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string })).filter((order) => {
    if (!search) return true;
    const value = [order.orderNumber, order.customerName, order.customerId, order.paymentId].join(" ").toLowerCase();
    return value.includes(search);
  });
  return NextResponse.json({ orders, hasMore: snap.size === pageSize, nextCursor: snap.size ? snap.docs[snap.docs.length - 1].id : null });
}

export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Only Admin may run backfill." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false;
  const db = adminDb();
  const snap = await db.collection("orders").get();
  const missing = snap.docs.filter((doc) => !doc.data().orderNumber);
  if (dryRun) return NextResponse.json({ dryRun: true, examined: snap.size, missing: missing.length, updated: 0 });

  let updated = 0;
  const year = new Date().getUTCFullYear();
  for (const chunk of Array.from({ length: Math.ceil(missing.length / 400) }, (_, i) => missing.slice(i * 400, i * 400 + 400))) {
    await db.runTransaction(async (tx) => {
      const counter = db.collection("system").doc("orderNumberCounter");
      const counterSnap = await tx.get(counter);
      let next = (counterSnap.data()?.next as number | undefined) ?? 1;
      for (const order of chunk) {
        tx.update(order.ref, { orderNumber: `FN-${year}-${String(next).padStart(6, "0")}` });
        next += 1;
        updated += 1;
      }
      tx.set(counter, { next, updatedAt: Timestamp.now() }, { merge: true });
    });
  }
  return NextResponse.json({ dryRun: false, examined: snap.size, missing: missing.length, updated });
}
