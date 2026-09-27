import { addDoc, collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { ServiceDoc, ServiceAreaDoc, PaymentAccountDoc } from "@/types/models";

export async function listAllServices(): Promise<Array<ServiceDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "services"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ServiceDoc) }));
}

export async function createService(service: Omit<ServiceDoc, "version">): Promise<string> {
  // version starts at 1; future price edits bump it for traceability, but
  // existing orders' pricingSnapshot.pricingVersion is never touched.
  const ref = await addDoc(collection(db, "services"), { ...service, version: 1 });
  return ref.id;
}

export async function updateService(serviceId: string, fields: Partial<ServiceDoc>): Promise<void> {
  await updateDoc(doc(db, "services", serviceId), fields as Record<string, unknown>);
}

export async function listAllServiceAreas(): Promise<Array<ServiceAreaDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "serviceAreas"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ServiceAreaDoc) }));
}

export async function createServiceArea(area: ServiceAreaDoc): Promise<string> {
  const ref = await addDoc(collection(db, "serviceAreas"), area);
  return ref.id;
}

export async function updateServiceArea(areaId: string, fields: Partial<ServiceAreaDoc>): Promise<void> {
  await updateDoc(doc(db, "serviceAreas", areaId), fields as Record<string, unknown>);
}

export async function listAllPaymentAccounts(): Promise<Array<PaymentAccountDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "paymentAccounts"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as PaymentAccountDoc) }));
}

export async function createPaymentAccount(account: PaymentAccountDoc): Promise<string> {
  const ref = await addDoc(collection(db, "paymentAccounts"), account);
  return ref.id;
}

export async function updatePaymentAccount(accountId: string, fields: Partial<PaymentAccountDoc>): Promise<void> {
  await updateDoc(doc(db, "paymentAccounts", accountId), fields as Record<string, unknown>);
}

export async function listAllRiders(): Promise<Array<import("@/types/models").RiderDoc & { id: string }>> {
  const snap = await getDocs(collection(db, "riders"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as import("@/types/models").RiderDoc) }));
}

export async function updateRider(
  riderId: string,
  fields: Partial<import("@/types/models").RiderDoc>
): Promise<void> {
  await updateDoc(doc(db, "riders", riderId), fields as Record<string, unknown>);
}
