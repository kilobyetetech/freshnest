import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";
import { PortalShell } from "@/components/PortalShell";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["finance", "admin"]}>
      <PortalShell portal="finance">{children}</PortalShell>
    </RoleGuard>
  );
}
