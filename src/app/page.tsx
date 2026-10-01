"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { portalPathForRole } from "@/lib/auth/portalPathForRole";
import { Brand } from "@/components/Brand";

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && role) {
      router.replace(portalPathForRole(role));
    }
  }, [loading, user, role, router]);

  if (loading || (user && role)) {
    return <main className="page">Loading…</main>;
  }

  return (
    <main className="hero">
      <Brand variant="full" />
      <h1>Laundry, picked up and delivered — without the errands.</h1>
      <p className="lead">
        Book a pickup, we wash and fold, you get it back fresh. FreshNest handles the rest.
      </p>
      <div className="actions">
        <Link className="button" href="/login">Log in</Link>
        <Link className="button secondary" href="/register">Create an account</Link>
      </div>

      <ol className="steps">
        <li>
          <span className="step-num">1</span>
          <span><strong>Book a pickup</strong><span>Tell us what needs washing and where to collect it.</span></span>
        </li>
        <li>
          <span className="step-num">2</span>
          <span><strong>We handle the wash</strong><span>Sorted, cleaned, and quality-checked at our facility.</span></span>
        </li>
        <li>
          <span className="step-num">3</span>
          <span><strong>Fresh laundry, delivered</strong><span>Back at your door, ready to put away.</span></span>
        </li>
      </ol>
    </main>
  );
}
