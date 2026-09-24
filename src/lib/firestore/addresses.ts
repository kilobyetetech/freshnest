import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { updateCustomerProfile } from "./profile";
import type { AddressDoc } from "@/types/models";

export async function listMyAddresses(uid: string): Promise<Array<AddressDoc & { id: string }>> {
  const q = query(collection(db, "addresses"), where("customerId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AddressDoc) }));
}

export async function createAddress(
  uid: string,
  address: Omit<AddressDoc, "customerId">
): Promise<string> {
  const ref = await addDoc(collection(db, "addresses"), {
    ...address,
    customerId: uid, // must match request.auth.uid per rules — never trust a passed-in value here
  });
  return ref.id;
}

export async function updateAddress(
  addressId: string,
  fields: Partial<Omit<AddressDoc, "customerId">>
): Promise<void> {
  // customerId is deliberately never included here — rules make it
  // immutable on update, so there's no point offering it client-side.
  await updateDoc(doc(db, "addresses", addressId), fields);
}

export async function deleteAddress(addressId: string): Promise<void> {
  await deleteDoc(doc(db, "addresses", addressId));
}

export async function setDefaultAddress(uid: string, addressId: string | null): Promise<void> {
  // The rule re-validates ownership of addressId server-side even though
  // this function only ever calls it with an address the UI already
  // scoped to the current user — the rule is the real boundary, not this
  // convenience wrapper.
  await updateCustomerProfile(uid, { defaultAddressId: addressId });
}
