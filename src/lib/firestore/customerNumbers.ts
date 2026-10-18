import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export function formatCustomerNumber(sequence: number): string {
  return `FNC-${String(sequence).padStart(6, "0")}`;
}

export async function allocateCustomerNumber(tx: Transaction, db: Firestore): Promise<string> {
  const counterRef = db.collection("system").doc("customerNumberCounter");
  const counterSnap = await tx.get(counterRef);
  const sequence = counterSnap.data()?.nextSequence ?? 1;
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Customer ID counter is invalid.");
  const customerId = formatCustomerNumber(sequence);
  const ownerSnap = await tx.get(db.collection("customerProfiles").where("customerId", "==", customerId).limit(1));
  if (!ownerSnap.empty) throw new Error("Customer ID allocation requires a retry.");
  tx.set(counterRef, { nextSequence: sequence + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return customerId;
}
