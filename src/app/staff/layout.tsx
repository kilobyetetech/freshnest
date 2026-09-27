import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allow={["staff", "admin"]}>{children}</RoleGuard>;
}
