import { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

export default function RiderLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allow={["rider", "admin"]}>{children}</RoleGuard>;
}
