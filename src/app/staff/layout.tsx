import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["staff", "admin"]}>
      <PortalShell portal="staff">{children}</PortalShell>
    </RoleGuard>
  );
}
