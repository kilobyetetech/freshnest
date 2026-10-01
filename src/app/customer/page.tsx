"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Icon } from "@/components/Icon";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const firstName = user?.displayName?.split(" ")[0];

  return (
    <main className="page">
      <h1>{firstName ? `Hi, ${firstName}` : "Welcome"}</h1>

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
