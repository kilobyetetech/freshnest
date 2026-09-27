import { Firestore } from "firebase-admin/firestore";
import type { PricingSnapshot, PricingSnapshotItem, ServiceDoc, ServiceAreaDoc } from "@/types/models";

export interface OrderItemInput {
  serviceId: string;
  quantity: number;
  weight?: number;
}

/**
 * Server-side authoritative pricing. The client never supplies a price or
 * amount -- only serviceId/quantity/weight/serviceAreaId/promotionCode.
 * This is the one place a price is computed; every order stores the
 * result as an immutable pricingSnapshot that later price changes never
 * touch.
 */
export async function computePricingSnapshot(
  db: Firestore,
  items: OrderItemInput[],
  serviceAreaId: string,
  promotionCode?: string
): Promise<PricingSnapshot> {
  if (!items.length) {
    throw new Error("At least one item is required.");
  }

  const snapshotItems: PricingSnapshotItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const serviceSnap = await db.collection("services").doc(item.serviceId).get();
    if (!serviceSnap.exists) {
      throw new Error(`Service ${item.serviceId} does not exist.`);
    }
    const service = serviceSnap.data() as ServiceDoc;
    if (!service.active) {
      throw new Error(`Service ${service.name} is not currently active.`);
    }

    let lineSubtotal: number;
    switch (service.pricingModel) {
      case "per_item":
        lineSubtotal = service.unitPrice * item.quantity;
        break;
      case "per_kg":
        if (!item.weight || item.weight <= 0) {
          throw new Error(`Service ${service.name} requires a weight in kg.`);
        }
        lineSubtotal = service.unitPrice * item.weight;
        break;
      case "flat":
        lineSubtotal = service.unitPrice;
        break;
      case "custom_quote":
        // Custom-quote services are out of scope for automatic pricing in
        // Phase 2 -- flagged clearly rather than guessed at.
        throw new Error(
          `Service ${service.name} requires a custom quote and cannot be ordered through the standard flow yet.`
        );
      default:
        throw new Error(`Unknown pricing model for service ${service.name}.`);
    }

    subtotal += lineSubtotal;
    snapshotItems.push({
      serviceId: item.serviceId,
      name: service.name,
      unitPrice: service.unitPrice,
      quantity: item.quantity,
      subtotal: lineSubtotal,
    });
  }

  const areaSnap = await db.collection("serviceAreas").doc(serviceAreaId).get();
  if (!areaSnap.exists) {
    throw new Error("Service area does not exist.");
  }
  const area = areaSnap.data() as ServiceAreaDoc;
  if (!area.active) {
    throw new Error("This service area is not currently active.");
  }
  if (subtotal < area.minOrder) {
    throw new Error(`Order subtotal must be at least ${area.minOrder} for this service area.`);
  }

  let discount = 0;
  let appliedPromotionCode: string | null = null;
  if (promotionCode) {
    const promoQuery = await db
      .collection("promotions")
      .where("code", "==", promotionCode)
      .limit(1)
      .get();
    if (promoQuery.empty) {
      throw new Error("Invalid promotion code.");
    }
    const promoDoc = promoQuery.docs[0];
    const promo = promoDoc.data();
    const now = Date.now();
    const startsOk = !promo.startDate || new Date(promo.startDate).getTime() <= now;
    const endsOk = !promo.endDate || new Date(promo.endDate).getTime() >= now;
    const usageOk = !promo.usageLimit || (promo.usageCount ?? 0) < promo.usageLimit;
    if (!startsOk || !endsOk || !usageOk) {
      throw new Error("This promotion code is no longer valid.");
    }
    discount =
      promo.discountType === "percent"
        ? Math.round(subtotal * (promo.discountValue / 100))
        : promo.discountValue;
    appliedPromotionCode = promotionCode;
    // Usage count increment happens transactionally in the caller
    // (createOrder), alongside the order write, not here -- this
    // function only computes numbers, it does not write anything.
  }

  const total = Math.max(0, subtotal + area.pickupFee + area.deliveryFee - discount);

  return {
    pricingVersion: 1,
    items: snapshotItems,
    subtotal,
    deliveryFee: area.deliveryFee,
    pickupFee: area.pickupFee,
    expressFee: 0,
    discount,
    promotionCode: appliedPromotionCode,
    otherCharges: 0,
    total,
    // Firestore server timestamp is applied by the caller when writing,
    // not here, since this function doesn't have write access.
    calculatedAt: null,
  };
}
