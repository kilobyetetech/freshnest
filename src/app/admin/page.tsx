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
          Orders, finance, and rider dashboards ship in later phases. Phase 1
          only provides account provisioning.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link className="button" href="/admin/staff" style={{ textAlign: "center", textDecoration: "none" }}>
          Provision staff account
        </Link>
        <button className="button" style={{ background: "#999" }} onClick={() => signOut(auth)}>
          Log out
        </button>
      </div>
    </main>
  );
}
