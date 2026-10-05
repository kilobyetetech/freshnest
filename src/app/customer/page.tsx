"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/Icon";

interface GrowthSummary {
  segment: string;
  lifecycleStage: string;
  totalOrders: number;
  completedOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  daysSinceLastOrder: number | null;
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [growth, setGrowth] = useState<GrowthSummary | null>(null);
  const firstName = user?.displayName?.split(" ")[0];

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/customer/growth", { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setGrowth((await response.json()) as GrowthSummary);
    })();
  }, [user]);

  return (
    <main className="page">
      <h1>{firstName ? `Hi, ${firstName}` : "Welcome"}</h1>
      {growth && (
        <section className="card" aria-label="Customer account summary" style={{ marginBottom: 20 }}>
          <div className="row-between">
            <div>
              <strong>{growth.segment}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>{growth.lifecycleStage}</p>
            </div>
            <Icon name="receipt" />
          </div>
          <div className="stat-band" style={{ marginTop: 16 }}>
            <div className="stat"><div className="stat-value">{growth.completedOrders}</div><div className="stat-label">Completed</div></div>
            <div className="stat"><div className="stat-value">₦{Math.round(growth.averageOrderValue).toLocaleString()}</div><div className="stat-label">Avg. order</div></div>
          </div>
        </section>
      )}

      <Link href="/customer/orders/new" className="button" style={{ marginBottom: 20 }}>
        <Icon name="plus" size={18} /> Place a new order
      </Link>

      <Link href="/customer/orders/new" className="button" style={{ marginBottom: 20 }}>
        <Icon name="plus" size={18} /> Place a new order
      </Link>

      <div className="list-group">
        <Link href="/customer/orders" className="list-row">
          <span className="list-icon"><Icon name="bag" /></span>
          <span className="list-text">
            <span className="list-title">My orders</span>
            <span className="list-sub">Track status and payments</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/customer/addresses" className="list-row">
          <span className="list-icon"><Icon name="pin" /></span>
          <span className="list-text">
            <span className="list-title">My addresses</span>
            <span className="list-sub">Where we pick up and drop off</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/customer/profile" className="list-row">
          <span className="list-icon"><Icon name="user" /></span>
          <span className="list-text">
            <span className="list-title">My profile</span>
            <span className="list-sub">Name, phone, email</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
      </div>
    </main>
  );
}
