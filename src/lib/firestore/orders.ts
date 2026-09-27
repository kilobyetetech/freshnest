import { collection, doc, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { OrderDoc } from "@/types/models";

export async function listMyOrders(uid: string): Promise<Array<OrderDoc & { id: string }>> {
  const q = query(collection(db, "orders"), where("customerId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OrderDoc) }));
}

export async function getOrder(orderId: string): Promise<(OrderDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db, "orders", orderId));
  return snap.exists() ? { id: snap.id, ...(snap.data() as OrderDoc) } : null;
}

export async function getOrderStatusHistory(orderId: string) {
  const snap = await getDocs(
    query(collection(db, "orders", orderId, "statusHistory"), orderBy("timestamp", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Finance/Admin view: payments awaiting verification. */
export async function listPendingPayments() {
  const q = query(collection(db, "payments"), where("status", "==", "pending_verification"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Staff/Admin/rider-manager view: pickup jobs (no financial fields exist on this doc). */
export async function listMyPickupJobs(riderId: string) {
  const q = query(collection(db, "pickupJobs"), where("riderId", "==", riderId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
