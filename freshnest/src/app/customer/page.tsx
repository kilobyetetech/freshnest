"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function CustomerDashboard() {
  const { user } = useAuth();

  return (
    <main className="page">
      <h1>Welcome{user?.displayName ? `, ${user.displayName}` : ""}</h1>

      <div className="card">
        <strong>Orders</strong>
        <p style={{ color: "#666", fontSize: 14 }}>
          Ordering isn&rsquo;t available yet — this ships in Phase 2. There is
          nothing to show here yet, so nothing is shown.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link className="button" href="/customer/profile" style={{ textAlign: "center", textDecoration: "none" }}>
          My profile
        </Link>
        <Link
          className="button"
          href="/customer/addresses"
          style={{ textAlign: "center", textDecoration: "none", background: "#333" }}
        >
          My addresses
        </Link>
        <button
          className="button"
          style={{ background: "#999" }}
          onClick={() => signOut(auth)}
        >
          Log out
        </button>
      </div>
    </main>
  );
}
