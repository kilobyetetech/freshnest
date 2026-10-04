import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { verifyCaller } from "@/lib/firebase/verifyCaller";
import { classifyCustomer } from "@/lib/growth";

export async function GET(req: NextRequest) {
  const caller = await verifyCaller(req);
  if (!caller || caller.role !== "customer") {
    return NextResponse.json({ error: "Only customers can view these insights." }, { status: 403 });
  }

  const db = adminDb();
  const snapshot = await db.collection("orders")
    .where("customerId", "==", caller.uid)
    .orderBy(FieldPath.documentId())
    .get();
  const orders = snapshot.docs.map((doc) => doc.data());
  const completedOrders = orders.filter((order) => order.orderStatus === "Completed" || order.orderStatus === "Delivered");
  const totalSpend = completedOrders.reduce((sum, order) => sum + Number(order.pricingSnapshot?.total ?? 0), 0);
  const lastOrderAt = orders.reduce<unknown>((latest, order) => {
    const current = order.createdAt;
    if (!latest) return current;
    const latestMs = typeof (latest as { toMillis?: () => number }).toMillis === "function" ? (latest as { toMillis: () => number }).toMillis() : 0;
    const currentMs = typeof (current as { toMillis?: () => number })?.toMillis === "function" ? (current as { toMillis: () => number }).toMillis() : 0;
    return currentMs > latestMs ? current : latest;
  }, null);
  const classification = classifyCustomer({ totalOrders: orders.length, completedOrders: completedOrders.length, totalSpend, lastOrderAt });

  return NextResponse.json({
    totalOrders: orders.length,
    completedOrders: completedOrders.length,
    totalSpend,
    averageOrderValue: completedOrders.length ? totalSpend / completedOrders.length : 0,
    lastOrderAt,
    ...classification,
  });
}
