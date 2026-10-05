import { addDoc, collection, getDocs, Timestamp, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type PromotionType = "percentage" | "fixed";
export type PromotionDoc = {
  code: string;
  name: string;
  description: string;
  type: PromotionType;
  value: number;
  minimumOrderAmount: number;
  maximumDiscount: number | null;
  customerEligibility: "all" | "first_order";
  usageLimit: number | null;
  perCustomerLimit: number;
  startsAt: Timestamp;
  expiresAt: Timestamp;
  active: boolean;
  createdAt: Timestamp;
};

export async function listPromotions(): Promise<Array<PromotionDoc & { id: string }>> {
  const snapshot = await getDocs(collection(db, "promotions"));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as PromotionDoc) }))
    .sort((a, b) => b.startsAt.toMillis() - a.startsAt.toMillis());
}

export async function createPromotion(input: Omit<PromotionDoc, "createdAt" | "active">) {
  const ref = await addDoc(collection(db, "promotions"), {
    ...input,
    code: input.code.trim().toUpperCase(),
    active: true,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export function updatePromotion(id: string, fields: Partial<Pick<PromotionDoc, "active">>) {
  return updateDoc(doc(db, "promotions", id), fields);
}

export function promotionIsLive(promotion: PromotionDoc) {
  const now = Date.now();
  return promotion.active && promotion.startsAt.toMillis() <= now && promotion.expiresAt.toMillis() >= now;
}
