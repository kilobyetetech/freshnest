"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listActiveServices } from "@/lib/firestore/catalog";
import { listMyAddresses } from "@/lib/firestore/addresses";
import { auth } from "@/lib/firebase/client";
import { Icon } from "@/components/Icon";
import type { ServiceDoc, AddressDoc } from "@/types/models";

type ServiceWithId = ServiceDoc & { id: string };
type AddressWithId = AddressDoc & { id: string };

export default function NewOrderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [addresses, setAddresses] = useState<AddressWithId[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [addressId, setAddressId] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([listActiveServices(), listMyAddresses(user.uid)]).then(([s, a]) => {
      setServices(s);
      const withArea = a.filter((addr) => addr.serviceAreaId);
      setAddresses(withArea);
      if (withArea.length) setAddressId(withArea[0].id);
      setLoading(false);
    });
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([serviceId, qty]) => ({ serviceId, quantity: Number(qty) }));

    if (!items.length) {
      setError("Add at least one item.");
      return;
    }
    if (!addressId) {
      setError("Select an address with a service area.");
      return;
    }

    setBusy(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ items, addressId, promotionCode: promotionCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create order.");
      router.push(`/customer/orders/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="page">Loading…</main>;

  if (!addresses.length) {
    return (
      <main className="page">
        <h1>New order</h1>
        <div className="empty">
          <strong>You need an address first</strong>
          Add one with a service area on the <a href="/customer/addresses">addresses page</a>.
        </div>
      </main>
    );
  }

  if (!services.length) {
    return (
      <main className="page">
        <h1>New order</h1>
        <div className="empty">
          <strong>Nothing to order yet</strong>
          No services are available right now — check back soon.
        </div>
      </main>
    );
  }

  const selectedCount = Object.values(quantities).filter((q) => Number(q) > 0).length;

  return (
    <main className="page">
      <h1>New order</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>Deliver to</label>
        <select className="field" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
          {addresses.map((a) => (
            <option key={a.id} value={a.id}>{a.label} — {a.line1}</option>
          ))}
        </select>

        <div className="section-title" style={{ marginTop: 20 }}>Items</div>
        <div className="list-group" style={{ marginBottom: 16 }}>
          {services.map((s) => (
            <div key={s.id} className="list-row" style={{ cursor: "default" }}>
              <span className="list-icon"><Icon name="tag" /></span>
              <span className="list-text">
                <span className="list-title">{s.name}</span>
                <span className="list-sub">
                  ₦{s.unitPrice} {s.pricingModel === "per_kg" ? "/kg" : s.pricingModel === "flat" ? "flat" : "/item"}
                </span>
              </span>
              <input
                type="number"
                min={0}
                className="field"
                style={{ width: 64, marginBottom: 0, textAlign: "center", padding: 8 }}
                placeholder="0"
                value={quantities[s.id] ?? ""}
                onChange={(e) => setQuantities({ ...quantities, [s.id]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <input
          className="field"
          placeholder="Promotion code (optional)"
          value={promotionCode}
          onChange={(e) => setPromotionCode(e.target.value)}
        />

        <button className="button" type="submit" disabled={busy || !selectedCount}>
          {busy ? "Placing order…" : "Place order"}
        </button>
      </form>
    </main>
  );
}
