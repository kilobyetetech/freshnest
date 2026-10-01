"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

const LABELS: Record<string, string> = {
  customer: "Customer",
  admin: "Admin",
  finance: "Finance",
  staff: "Staff",
  rider: "Rider",
};

/**
 * Shared chrome for every signed-in portal: brand, which portal you're in
 * (also encoded by accent colour), who you are, and log out. Individual
 * pages only render their own content inside it.
 */
export function PortalShell({ portal, children }: { portal: string; children: ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const isRoot = pathname === `/${portal}`;
  const initial = (user?.displayName || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div data-portal={portal}>
      <header className="shell-header">
        <div className="shell-header-inner">
          <Brand href={`/${portal}`} />
          <span className="portal-chip">{LABELS[portal] ?? portal}</span>
          <span className="grow" />
          <span className="avatar" title={user?.email ?? ""}>{initial}</span>
          <button className="link-button" onClick={() => signOut(auth)}>
            Log out
          </button>
        </div>
      </header>
      <div className="shell-body">
        {!isRoot && (
          <Link href={`/${portal}`} className="back-link">
            <Icon name="chevron" size={16} />
            Dashboard
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
