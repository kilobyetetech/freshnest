import Link from "next/link";

export default function HomePage() {
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
