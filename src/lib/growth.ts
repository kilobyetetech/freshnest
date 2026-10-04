import { Timestamp } from "firebase-admin/firestore";

export const RETENTION_THRESHOLDS = {
  atRiskAfterDays: 30,
  inactiveAfterDays: 90,
} as const;

export type CustomerSegment =
  | "New Customer"
  | "Active Customer"
  | "Repeat Customer"
  | "High-Value Customer"
  | "At-Risk Customer"
  | "Inactive Customer";

export type LifecycleStage =
  | "Registered"
  | "First Order"
  | "First Completed Order"
  | "Repeat Order"
  | "Loyal Customer";

function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  return null;
}

export function classifyCustomer(input: {
  totalOrders: number;
  completedOrders: number;
  totalSpend: number;
  lastOrderAt: unknown;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const lastOrder = asDate(input.lastOrderAt);
  const daysSinceLastOrder = lastOrder
    ? Math.max(0, Math.floor((now.getTime() - lastOrder.getTime()) / 86400000))
    : null;

  let segment: CustomerSegment = "New Customer";
  if (input.totalSpend >= 100000) segment = "High-Value Customer";
  else if (daysSinceLastOrder !== null && daysSinceLastOrder >= RETENTION_THRESHOLDS.inactiveAfterDays) segment = "Inactive Customer";
  else if (daysSinceLastOrder !== null && daysSinceLastOrder >= RETENTION_THRESHOLDS.atRiskAfterDays) segment = "At-Risk Customer";
  else if (input.completedOrders >= 2) segment = "Repeat Customer";
  else if (input.totalOrders > 0) segment = "Active Customer";

  let lifecycleStage: LifecycleStage = "Registered";
  if (input.totalOrders > 0) lifecycleStage = "First Order";
  if (input.completedOrders > 0) lifecycleStage = "First Completed Order";
  if (input.completedOrders >= 2) lifecycleStage = "Repeat Order";
  if (input.completedOrders >= 5) lifecycleStage = "Loyal Customer";

  return { segment, lifecycleStage, daysSinceLastOrder };
}

export { asDate };
