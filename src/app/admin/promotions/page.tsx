"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { createPromotion, listPromotions, promotionIsLive, updatePromotion, type PromotionDoc, type PromotionType } from "@/lib/firestore/promotions";
import { Timestamp } from "firebase/firestore";

type PromotionWithId = PromotionDoc & { id: string };

function toTimestamp(value: string) {
  return Timestamp.fromDate(new Date(`${value}T23:59:59`));
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<PromotionType>("percentage");
  const [value, setValue] = useState("");
  const [minimumOrderAmount, setMinimumOrderAmount] = useState("0");
  const [eligibility, setEligibility] = useState<"all" | "first_order">("all");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");

  async function refresh() {
    try { setPromotions(await listPromotions()); } catch (err) { setError(err instanceof Error ? err.message : "Could not load promotions."); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const numericValue = Number(value);
    if (!/^[a-z0-9_-]{3,24}$/i.test(code) || !name.trim() || numericValue <= 0 || (type === "percentage" && numericValue > 100) || !expiresAt || new Date(expiresAt) < new Date(startsAt)) {
      setError("Enter a valid code, positive discount, and an end date after the start date.");
      return;
    }
    setSaving(true);
    try {
      await createPromotion({ code, name: name.trim(), description: "", type, value: numericValue, minimumOrderAmount: Math.max(0, Number(minimumOrderAmount) || 0), maximumDiscount: null, customerEligibility: eligibility, usageLimit: null, perCustomerLimit: 1, startsAt: toTimestamp(startsAt), expiresAt: toTimestamp(expiresAt) });
      setCode(""); setName(""); setValue(""); setExpiresAt(""); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create promotion."); } finally { setSaving(false); }
  }

  async function toggle(promotion: PromotionWithId) {
    try { await updatePromotion(promotion.id, { active: !promotion.active }); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update promotion."); }
  }

  return <main className="page">
    <h1>Promotions</h1>
    <p className="muted" style={{ marginTop: -10, marginBottom: 24 }}>Create controlled offers that can be applied to eligible orders.</p>
    {error && <p className="error">{error}</p>}
    {!loading && <div className="list-group" style={{ marginBottom: 24 }}>
      {promotions.length === 0 ? <div className="empty"><strong>No promotions yet</strong>Create your first customer offer below.</div> : promotions.map((promotion) => <div className="list-row" key={promotion.id} style={{ cursor: "default" }}>
        <span className="list-icon"><Icon name="tag" /></span><span className="list-text"><span className="list-title">{promotion.code} · {promotion.name}</span><span className="list-sub">{promotion.type === "percentage" ? `${promotion.value}% off` : `₦${promotion.value.toLocaleString()} off`} · {promotion.customerEligibility === "first_order" ? "First order" : "Everyone"}</span></span><span className={`badge ${promotionIsLive(promotion) ? "ok" : ""}`}>{promotion.active ? (promotionIsLive(promotion) ? "Live" : "Scheduled") : "Off"}</span><button className="button secondary small" onClick={() => void toggle(promotion)}>{promotion.active ? "Turn off" : "Turn on"}</button>
      </div>)}
    </div>}
    <div className="section-title">Create a promotion</div><div className="card"><form onSubmit={(event) => void handleCreate(event)}>
      <input className="field" placeholder="Code (e.g. WELCOME10)" value={code} onChange={(event) => setCode(event.target.value)} required />
      <input className="field" placeholder="Offer name" value={name} onChange={(event) => setName(event.target.value)} required />
      <select className="field" value={type} onChange={(event) => setType(event.target.value as PromotionType)}><option value="percentage">Percentage discount</option><option value="fixed">Fixed discount</option></select>
      <input className="field" type="number" min="0.01" step="0.01" placeholder={type === "percentage" ? "Discount percent" : "Discount amount (₦)"} value={value} onChange={(event) => setValue(event.target.value)} required />
      <input className="field" type="number" min="0" step="1" placeholder="Minimum order (₦)" value={minimumOrderAmount} onChange={(event) => setMinimumOrderAmount(event.target.value)} />
      <select className="field" value={eligibility} onChange={(event) => setEligibility(event.target.value as "all" | "first_order")}><option value="all">All customers</option><option value="first_order">First order only</option></select>
      <label className="field-label">Starts<input className="field" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
      <label className="field-label">Expires<input className="field" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required /></label>
      <button className="button" type="submit" disabled={saving}>{saving ? "Saving…" : "Create promotion"}</button>
    </form></div>
  </main>;
}
