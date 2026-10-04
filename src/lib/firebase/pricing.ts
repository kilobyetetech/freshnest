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
  promotionCode?: string,
  customerId?: string
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
    const normalizedCode = promotionCode.trim().toUpperCase();
    const promoQuery = await db.collection("promotions").where("code", "==", normalizedCode).limit(1).get();
    if (promoQuery.empty) throw new Error("Invalid promotion code.");
    const promo = promoQuery.docs[0].data();
    const now = Date.now();
    const toMillis = (value: unknown) => {
      if (!value) return null;
      if (typeof value === "object" && value !== null && "toMillis" in value) return (value as { toMillis: () => number }).toMillis();
      const parsed = new Date(String(value)).getTime();
      return Number.isFinite(parsed) ? parsed : null;
    };
    const startsAt = toMillis(promo.startsAt ?? promo.startDate);
    const expiresAt = toMillis(promo.expiresAt ?? promo.endDate);
    if (promo.active !== true || (startsAt !== null && startsAt > now) || (expiresAt !== null && expiresAt < now)) {
      throw new Error("This promotion code is no longer valid.");
    }
    if (typeof promo.minimumOrderAmount === "number" && subtotal < promo.minimumOrderAmount) {
      throw new Error(`This promotion requires a minimum order of ${promo.minimumOrderAmount}.`);
    }
    if (Array.isArray(promo.serviceIds) && promo.serviceIds.length && !snapshotItems.some((item) => promo.serviceIds.includes(item.serviceId))) {
      throw new Error("This promotion does not apply to the selected services.");
    }
    if (Array.isArray(promo.serviceAreaIds) && promo.serviceAreaIds.length && !promo.serviceAreaIds.includes(serviceAreaId)) {
      throw new Error("This promotion is not available in your service area.");
    }
    if (promo.customerEligibility === "first_order" && customerId) {
      const priorOrders = await db.collection("orders").where("customerId", "==", customerId).limit(1).get();
      if (!priorOrders.empty) throw new Error("This promotion is only available on your first order.");
    }
    if (promo.usageLimit && (promo.usageCount ?? 0) >= promo.usageLimit) throw new Error("This promotion has reached its usage limit.");
    discount = promo.type === "fixed" || promo.discountType === "fixed"
      ? Number(promo.value ?? promo.discountValue ?? 0)
      : Math.round(subtotal * Number(promo.value ?? promo.discountValue ?? 0) / 100);
    if (typeof promo.maximumDiscount === "number") discount = Math.min(discount, promo.maximumDiscount);
    discount = Math.min(Math.max(0, discount), subtotal + area.pickupFee + area.deliveryFee);
    appliedPromotionCode = normalizedCode;
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
