import { FieldValue } from "firebase-admin/firestore";
import type { OrderStatus, Role } from "@/types/models";

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["PickupScheduled", "Cancelled"],
  PickupScheduled: ["PickedUp", "Cancelled"],
  PickedUp: ["Received"],
  Received: ["Sorting"],
  Sorting: ["Washing"],
  Washing: ["Drying"],
  Drying: ["IroningFolding"],
  IroningFolding: ["QualityCheck"],
  QualityCheck: ["ReadyForDelivery", "Washing"],
  ReadyForDelivery: ["OutForDelivery"],
  OutForDelivery: ["Delivered"],
  Delivered: ["Completed"],
  Completed: [],
  Cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function serverAuditEvent(caller: { uid: string; role?: Role }, orderId: string, fromStatus: OrderStatus, toStatus: OrderStatus, reason: string) {
  return {
    orderId,
    fromStatus,
    toStatus,
    changedByUid: caller.uid,
    changedByRole: caller.role ?? "customer",
    timestamp: FieldValue.serverTimestamp(),
    reason: reason.slice(0, 500),
    source: "vercel-api",
  };
}

export function operationalRole(role?: Role) {
  return role === "admin" || role === "staff" || role === "rider";
}
