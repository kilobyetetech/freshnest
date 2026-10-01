import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["admin"]}>
      <PortalShell portal="admin">{children}</PortalShell>
    </RoleGuard>
  );
}
