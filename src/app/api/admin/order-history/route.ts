import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { formatOrderNumber, nextAvailableSequence } from "@/lib/firestore/orderBackfill";

const allowed = new Set(["admin", "finance"]);

export async function GET(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || !allowed.has(caller.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
  const pageSize = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;
  const db = adminDb();
  // Search must cover the complete historical collection. Firestore cannot perform
  // a contains query across these fields, so a bounded server-side scan is used.
  const snap = await db.collection("orders").orderBy("createdAt", "desc").limit(5000).get();
  const matches = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string })).filter((order) => {
    if (!search) return true;
    const value = [order.orderNumber, order.customerName, order.customerId, order.paymentId, order.paymentReference].join(" ").toLowerCase();
    return value.includes(search);
  });
  const orders = matches.slice(0, pageSize);
  return NextResponse.json({ orders, hasMore: matches.length > pageSize, nextCursor: orders.length ? orders[orders.length - 1].id : null, scanned: snap.size });
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
  const existingOrderNumbers = snap.docs.map((doc) => doc.data().orderNumber);
  for (const chunk of Array.from({ length: Math.ceil(missing.length / 400) }, (_, i) => missing.slice(i * 400, i * 400 + 400))) {
    const changed = await db.runTransaction(async (tx) => {
      const counter = db.collection("system").doc("orderNumberCounter");
      const counterSnap = await tx.get(counter);
      const orderSnapshots = await Promise.all(chunk.map((order) => tx.get(order.ref)));
      let next = nextAvailableSequence(existingOrderNumbers, counterSnap.data()?.next, year);
      let count = 0;
      orderSnapshots.forEach((orderSnapshot, index) => {
        if (orderSnapshot.data()?.orderNumber) return;
        tx.update(chunk[index].ref, { orderNumber: formatOrderNumber(year, next) });
        existingOrderNumbers.push(formatOrderNumber(year, next));
        next += 1;
        count += 1;
      });
      if (count) tx.set(counter, { next, updatedAt: Timestamp.now() }, { merge: true });
      return count;
    });
    updated += changed;
  }
  return NextResponse.json({ dryRun: false, examined: snap.size, missing: missing.length, updated });
}
