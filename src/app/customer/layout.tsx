import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allow={["customer"]}>{children}</RoleGuard>;
}
