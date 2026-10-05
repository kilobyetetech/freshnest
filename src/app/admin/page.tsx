"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AdminDashboard() {
  return (
    <main className="page wide">
      <h1>Admin</h1>
      <p className="muted" style={{ marginTop: -10, marginBottom: 24 }}>
        Manage pricing, coverage, accounts, and people.
      </p>

      <div className="empty" style={{ marginBottom: 8 }}>
        <strong>Reports are coming in a later phase</strong>
        Order volume, revenue, and rider KPIs will live here once Finance reporting ships.
      </div>

      <div className="section-title">Catalog & coverage</div>
      <div className="list-group">
        <Link href="/admin/services" className="list-row">
          <span className="list-icon"><Icon name="tag" /></span>
          <span className="list-text">
            <span className="list-title">Services & pricing</span>
            <span className="list-sub">What you offer, and what it costs</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/admin/service-areas" className="list-row">
          <span className="list-icon"><Icon name="pin" /></span>
          <span className="list-text">
            <span className="list-title">Service areas</span>
            <span className="list-sub">Coverage, pickup & delivery fees</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/admin/payment-accounts" className="list-row">
          <span className="list-icon"><Icon name="card" /></span>
          <span className="list-text">
            <span className="list-title">Payment accounts</span>
            <span className="list-sub">Where customers send transfers</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/admin/promotions" className="list-row">
          <span className="list-icon"><Icon name="tag" /></span>
          <span className="list-text">
            <span className="list-title">Promotions</span>
            <span className="list-sub">Create and manage customer offers</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
      </div>

      <div className="section-title">People</div>
      <div className="list-group">
        <Link href="/admin/staff" className="list-row">
          <span className="list-icon"><Icon name="user" /></span>
          <span className="list-text">
            <span className="list-title">Provision staff account</span>
            <span className="list-sub">Create Admin, Finance, Staff, or Rider logins</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
        <Link href="/admin/riders" className="list-row">
          <span className="list-icon"><Icon name="bike" /></span>
          <span className="list-text">
            <span className="list-title">Riders</span>
            <span className="list-sub">Active status, coverage, workload</span>
          </span>
          <span className="chevron"><Icon name="chevron" /></span>
        </Link>
      </div>
    </main>
  );
}
