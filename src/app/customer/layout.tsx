import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["customer"]}>
      <PortalShell portal="customer">{children}</PortalShell>
    </RoleGuard>
  );
}
