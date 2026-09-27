export type Role = "customer" | "admin" | "finance" | "staff" | "rider";

export interface UserDoc {
  role: Role;
  email: string | null;
  phone: string | null;
  displayName: string;
  status: "active" | "inactive";
  createdAt: unknown;
}

export interface CustomerProfileDoc {
  name: string;
  phone: string | null;
  email: string | null;
  defaultAddressId: string | null;
  stats: {
    totalSpend: number;
    avgOrderValue: number;
    lastOrderAt: unknown;
  };
  notes: string;
}

export interface AddressDoc {
  customerId: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  geo?: { lat: number; lng: number } | null;
  serviceAreaId?: string | null;
}

export interface RiderDoc {
  name: string;
  phone: string | null;
  active: boolean;
  serviceAreaIds: string[];
  workingHours: unknown;
  currentWorkload: number;
  lastAssignedAt: unknown;
}

// ---------- Phase 2 ----------

export type PricingModel = "per_item" | "per_kg" | "flat" | "custom_quote";

export interface ServiceDoc {
  name: string;
  pricingModel: PricingModel;
  unitPrice: number;
  minOrder: number;
  turnaroundHours: number;
  active: boolean;
  version: number;
}

export interface ServiceAreaDoc {
  name: string;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  pickupFee: number;
  deliveryFee: number;
  minOrder: number;
  operatingDays: string[];
  assignedRiderIds: string[];
  active: boolean;
}

export interface PricingSnapshotItem {
  serviceId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface PricingSnapshot {
  pricingVersion: number;
  items: PricingSnapshotItem[];
  subtotal: number;
  deliveryFee: number;
  pickupFee: number;
  expressFee: number;
  discount: number;
  promotionCode: string | null;
  otherCharges: number;
  total: number;
  calculatedAt: unknown;
}

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "PickupScheduled"
  | "PickedUp"
  | "Received"
  | "Sorting"
  | "Washing"
  | "Drying"
  | "IroningFolding"
  | "QualityCheck"
  | "ReadyForDelivery"
  | "OutForDelivery"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export type PaymentStatus = "Unpaid" | "PendingVerification" | "Confirmed" | "Rejected";
export type RefundStatus = "None" | "Requested" | "UnderReview" | "Approved" | "PendingPayment" | "Paid" | "Rejected";

export interface OrderDoc {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  addressId: string;
  addressSnapshot: AddressDoc;
  serviceAreaId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  pricingSnapshot: PricingSnapshot;
  paymentMethod: "transfer";
  paymentId: string | null;
  assignedPickupJobId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export type PaymentDocStatus = "pending_verification" | "confirmed" | "rejected";

export interface PaymentDoc {
  orderId: string;
  customerId: string;
  amountExpected: number;
  transactionReference: string;
  status: PaymentDocStatus;
  verifiedBy: string | null;
  verifiedAt: unknown;
  rejectionReason: string | null;
  createdAt: unknown;
}

export interface PaymentAccountDoc {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  active: boolean;
}

export type JobStatus =
  | "Created"
  | "Assigned"
  | "Accepted"
  | "EnRoute"
  | "Arrived"
  | "Completed"
  | "Declined"
  | "Expired"
  | "Failed";

export interface PickupJobDoc {
  orderId: string;
  customerName: string;
  customerPhone: string | null;
  address: string;
  serviceAreaId: string;
  jobType: "pickup";
  jobStatus: JobStatus;
  riderId: string | null;
  assignedAt: unknown;
  acceptDeadline: unknown;
  acceptedAt: unknown;
  enRouteAt: unknown;
  arrivedAt: unknown;
  completedAt: unknown;
}
