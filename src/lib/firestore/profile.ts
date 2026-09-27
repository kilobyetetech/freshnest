import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { CustomerProfileDoc } from "@/types/models";

export async function getCustomerProfile(uid: string): Promise<CustomerProfileDoc | null> {
  const snap = await getDoc(doc(db, "customerProfiles", uid));
  return snap.exists() ? (snap.data() as CustomerProfileDoc) : null;
}

/**
 * Only name/phone/email/defaultAddressId are ever sent here — these are
 * exactly the fields the Security Rules allow the owning customer to
 * change (see firestore.rules, customerProfiles onlyChanging list).
 * Attempting to include any other field will be rejected server-side
 * regardless of what this function does, but we keep the client-side
 * surface area matched to the rule intentionally, so failures are rare
 * and not a UX surprise.
 */
export async function updateCustomerProfile(
  uid: string,
  fields: Partial<Pick<CustomerProfileDoc, "name" | "phone" | "email" | "defaultAddressId">>
): Promise<void> {
  await updateDoc(doc(db, "customerProfiles", uid), fields);
}
