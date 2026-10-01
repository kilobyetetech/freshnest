import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["rider", "admin"]}>
      <PortalShell portal="rider">{children}</PortalShell>
    </RoleGuard>
  );
}
