"use client";

import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function AdminDashboard() {
  return (
    <main className="page">
      <h1>Admin</h1>
      <div className="card">
        <strong>Operational dashboards</strong>
        <p style={{ color: "#666", fontSize: 14 }}>
          Finance reports, rider KPIs, and inventory ship in later phases.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link className="button" href="/admin/staff" style={{ textAlign: "center", textDecoration: "none" }}>
          Provision staff account
        </Link>
        <Link className="button" href="/admin/services" style={{ textAlign: "center", textDecoration: "none", background: "#333" }}>
          Services & pricing
        </Link>
        <Link className="button" href="/admin/service-areas" style={{ textAlign: "center", textDecoration: "none", background: "#333" }}>
          Service areas
        </Link>
        <Link className="button" href="/admin/payment-accounts" style={{ textAlign: "center", textDecoration: "none", background: "#333" }}>
          Payment accounts
        </Link>
        <Link className="button" href="/admin/riders" style={{ textAlign: "center", textDecoration: "none", background: "#333" }}>
          Riders
        </Link>
        <button className="button" style={{ background: "#999" }} onClick={() => signOut(auth)}>
          Log out
        </button>
      </div>
    </main>
  );
}
