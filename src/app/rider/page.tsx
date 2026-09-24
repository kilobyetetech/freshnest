"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function RiderDashboard() {
  return (
    <main className="page">
      <h1>Rider portal</h1>
      <div className="card">
        <p style={{ color: "#666", fontSize: 14 }}>
          Authentication and role-based access are in place for this portal.
          Its operational features ship in later phases — intentionally
          nothing else is shown here yet.
        </p>
      </div>
      <button className="button" style={{ background: "#999" }} onClick={() => signOut(auth)}>
        Log out
      </button>
    </main>
  );
}
