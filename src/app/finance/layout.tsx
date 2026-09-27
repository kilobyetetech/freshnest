import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allow={["finance", "admin"]}>{children}</RoleGuard>;
}
