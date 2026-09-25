"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { portalPathForRole } from "@/lib/auth/portalPathForRole";

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Safety net: if someone lands on the public home page while
    // already signed in (e.g. an old bookmark, or navigating back),
    // send them straight to their portal instead of showing them the
    // logged-out login/register buttons.
    if (!loading && user && role) {
      router.replace(portalPathForRole(role));
    }
  }, [loading, user, role, router]);

  if (loading || (user && role)) {
    return <main className="page">Loading…</main>;
  }

  return (
    <main className="page">
      <h1>FreshNest Laundry</h1>
      <p>Pickup, processing, and delivery — done right.</p>
      <p style={{ color: "#666", fontSize: 14 }}>
        The full public site (services, pricing, track order) ships in a later phase.
        Phase 1 covers accounts and addresses only.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Link className="button" href="/login" style={{ textAlign: "center", textDecoration: "none" }}>
          Log in
        </Link>
        <Link
          className="button"
          href="/register"
          style={{ textAlign: "center", textDecoration: "none", background: "#333" }}
        >
          Register
        </Link>
      </div>
    </main>
  );
}
