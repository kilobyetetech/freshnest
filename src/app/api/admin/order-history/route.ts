import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { allocateOrderNumber, formatOrderNumber, nextAvailableSequence, parseOrderNumber } from "@/lib/firestore/orderNumbers";

const allowed = new Set(["admin", "finance"]);
const projection = (role: string, id: string, order: Record<string, any>, payments: Record<string, any>[]) => ({
  id, orderNumber: order.orderNumber ?? null, customerId: order.customerId ?? null,
  customerName: order.customerName ?? null, orderStatus: order.orderStatus ?? null,
  paymentStatus: order.paymentStatus ?? null, refundStatus: order.refundStatus ?? null,
  createdAt: order.createdAt ?? null, updatedAt: order.updatedAt ?? null,
  total: order.pricingSnapshot?.total ?? null,
  ...(role === "admin" ? { serviceAreaId: order.serviceAreaId ?? null, paymentId: order.paymentId ?? null } : {}),
  payments: role === "finance" ? payments.map((p) => ({ id: p.id, transactionReference: p.transactionReference ?? null, status: p.status ?? null, amountExpected: p.amountExpected ?? null, amountRecorded: p.amountRecorded ?? null, verifiedAt: p.verifiedAt ?? null, verifiedBy: p.verifiedBy ?? null })) : undefined,
});

function encodeCursor(order: any) {
  const value = order.createdAt?.toMillis?.() ?? Date.now();
  return Buffer.from(JSON.stringify({ ms: value, id: order.id }), "utf8").toString("base64url");
}
function decodeCursor(value: string | null) {
  if (!value) return null;
  try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); return Number.isFinite(parsed.ms) && typeof parsed.id === "string" ? parsed : null; } catch { return null; }
}

export async function GET(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || !allowed.has(caller.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url); const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const requested = Number(url.searchParams.get("limit") ?? 50); const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), 100) : 50;
  const cursor = decodeCursor(url.searchParams.get("cursor")); if (url.searchParams.get("cursor") && !cursor) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  const db = adminDb(); let query: any = db.collection("orders").orderBy("createdAt", "desc").orderBy("__name__", "desc").limit(limit + 1);
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.ms), cursor.id);
  const snap = await query.get(); const docs = snap.docs; const hasMore = docs.length > limit; const pageDocs = docs.slice(0, limit);
  const matched = q ? pageDocs.filter((doc: any) => { const o = doc.data(); return [o.orderNumber, o.customerName, o.customerId, o.paymentId].some((v) => String(v ?? "").toLowerCase().includes(q)); }) : pageDocs;
  const orders = await Promise.all(matched.map(async (doc: any) => {
    const o = doc.data(); const paymentSnap = caller.role === "finance" ? await db.collection("payments").where("orderId", "==", doc.id).limit(20).get() : null;
    return projection(caller.role!, doc.id, o, paymentSnap?.docs.map((p: any) => ({ id: p.id, ...p.data() })) ?? []);
  }));
  return NextResponse.json({ orders, hasMore, nextCursor: hasMore && pageDocs.length ? encodeCursor({ ...pageDocs[pageDocs.length - 1].data(), id: pageDocs[pageDocs.length - 1].id }) : null });
}

export async function POST(req: NextRequest) {
  const caller = await verifyCaller(req); if (!caller || caller.role !== "admin") return NextResponse.json({ error: "Only Admin may run backfill." }, { status: 403 });
  const body = await req.json().catch(() => ({})); const dryRun = body?.dryRun !== false; const db = adminDb(); const snap = await db.collection("orders").get();
  const missing = snap.docs.filter((d) => !parseOrderNumber(d.data().orderNumber));
  if (dryRun) return NextResponse.json({ dryRun: true, examined: snap.size, missing: missing.length, updated: 0, collisions: 0, manualReview: 0 });
  let updated = 0; let collisions = 0; let manualReview = 0;
  for (let i = 0; i < missing.length; i += 400) {
    const chunk = missing.slice(i, i + 400);
    updated += await db.runTransaction(async (tx) => {
      let count = 0; const year = new Date().getUTCFullYear();
      const counterRef = db.doc("system/orderNumberCounter"); const counterSnap = await tx.get(counterRef); const existing = snap.docs.map((d) => d.data().orderNumber);
      const next = nextAvailableSequence(existing, counterSnap.data()?.nextSequence, year); let sequence = next;
      for (const doc of chunk) { const fresh = await tx.get(doc.ref); if (parseOrderNumber(fresh.data()?.orderNumber)) continue; const number = formatOrderNumber(year, sequence++); tx.update(doc.ref, { orderNumber: number }); count++; }
      if (count) tx.set(counterRef, { nextSequence: sequence, updatedAt: Timestamp.now() }, { merge: true }); return count;
    });
  }
  return NextResponse.json({ dryRun: false, examined: snap.size, missing: missing.length, updated, collisions, manualReview });
}
