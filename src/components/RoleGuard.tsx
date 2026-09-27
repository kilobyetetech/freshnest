"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Role } from "@/types/models";

/**
 * UI-layer gate only. This prevents an unauthorized portal from
 * rendering and redirects the user away from it — it is NOT what
 * protects the underlying data. Firestore/Storage Security Rules are the
 * actual boundary that denies reads/writes for the wrong role even if
 * this component (or the whole client bundle) is bypassed entirely.
 * Both layers are required and tested independently — see
 * test/rules/firestore.rules.test.ts for the data-layer enforcement.
 */
export function RoleGuard({
  allow,
  children,
}: {
  allow: Role[];
  children: ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!role || !allow.includes(role)) {
      router.replace("/");
    }
  }, [loading, user, role, allow, router]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500">Loading…</div>;
  }
  if (!user || !role || !allow.includes(role)) {
    // Render nothing while the redirect above takes effect, rather than
    // flashing protected content.
    return null;
  }
  return <>{children}</>;
}
