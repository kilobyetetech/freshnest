"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyOrders } from "@/lib/firestore/orders";
import type { OrderDoc } from "@/types/models";

export default function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Array<OrderDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    listMyOrders(user.uid).then((o) => {
      setOrders(o);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <main className="page">Loading…</main>;

  return (
    <main className="page">
      <h1>My orders</h1>
      <Link className="button" href="/customer/orders/new" style={{ textAlign: "center", textDecoration: "none", marginBottom: 16, display: "block" }}>
        Place a new order
      </Link>

      {orders.length === 0 && <p style={{ color: "#666", fontSize: 14 }}>No orders yet.</p>}

      {orders.map((o) => (
        <Link key={o.id} href={`/customer/orders/${o.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div className="card">
            <strong>₦{o.pricingSnapshot?.total ?? 0}</strong>
            <p style={{ margin: "4px 0", fontSize: 14, color: "#444" }}>
              {o.orderStatus} — Payment: {o.paymentStatus}
            </p>
          </div>
        </Link>
      ))}
    </main>
  );
}
