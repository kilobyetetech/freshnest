import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ServiceDoc, ServiceAreaDoc, PaymentAccountDoc } from "@/types/models";

export async function listActiveServices(): Promise<Array<ServiceDoc & { id: string }>> {
  const q = query(collection(db, "services"), where("active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ServiceDoc) }));
}

export async function listServiceAreas(): Promise<Array<ServiceAreaDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "serviceAreas"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ServiceAreaDoc) }));
}

export async function listActivePaymentAccounts(): Promise<Array<PaymentAccountDoc & { id: string }>> {
  const q = query(collection(db, "paymentAccounts"), where("active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PaymentAccountDoc) }));
}
