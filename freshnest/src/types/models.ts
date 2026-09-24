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
