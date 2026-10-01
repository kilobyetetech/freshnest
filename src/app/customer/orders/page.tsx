"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyOrders } from "@/lib/firestore/orders";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
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

      <Link href="/customer/orders/new" className="button" style={{ marginBottom: 20 }}>
        <Icon name="plus" size={18} /> Place a new order
      </Link>

      {orders.length === 0 ? (
        <div className="empty">
          <strong>No orders yet</strong>
          Your first order will show up here once you place it.
        </div>
      ) : (
        <div className="list-group">
          {orders.map((o) => (
            <Link key={o.id} href={`/customer/orders/${o.id}`} className="list-row">
              <span className="list-icon"><Icon name="bag" /></span>
              <span className="list-text">
                <span className="list-title">₦{o.pricingSnapshot?.total ?? 0}</span>
                <span className="list-sub">Payment: {o.paymentStatus}</span>
              </span>
              <StatusBadge status={o.orderStatus} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
