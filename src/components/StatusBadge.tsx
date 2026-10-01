type Tone = "ok" | "warn" | "danger" | "accent" | "";

const TONES: Record<string, Tone> = {
  Pending: "warn",
  PendingVerification: "warn",
  Unpaid: "warn",
  Created: "warn",
  Assigned: "warn",
  Confirmed: "accent",
  Accepted: "accent",
  EnRoute: "accent",
  Arrived: "accent",
  PickupScheduled: "accent",
  PickedUp: "accent",
  Received: "accent",
  Sorting: "accent",
  Washing: "accent",
  Drying: "accent",
  IroningFolding: "accent",
  QualityCheck: "accent",
  ReadyForDelivery: "accent",
  OutForDelivery: "accent",
  Delivered: "ok",
  Completed: "ok",
  Rejected: "danger",
  Cancelled: "danger",
  Declined: "danger",
  Failed: "danger",
  Expired: "danger",
};

/** "PendingVerification" -> "Pending verification" */
export function humanize(status: string): string {
  const spaced = status.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0) + spaced.slice(1).toLowerCase();
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${TONES[status] ?? ""}`}>{humanize(status)}</span>;
}
