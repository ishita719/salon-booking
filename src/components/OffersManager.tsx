"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { formatDate } from "@/lib/time";

interface Offer {
  id: string;
  title: string;
  description: string;
  label: string;
  discountType: "PERCENT" | "AMOUNT";
  value: number;
  serviceIds: string[];
  categories: string[];
  firstVisitOnly: boolean;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
  live: boolean;
  appliesToAll: boolean;
  appliesTo: { id: string; name: string }[];
}
interface Svc { id: string; name: string; category: string }
type Draft = { id?: string; title: string; description: string; discountType: "PERCENT" | "AMOUNT"; amount: string; serviceIds: string[]; categories: string[]; firstVisitOnly: boolean; startsOn: string; endsOn: string; active: boolean };

const EMPTY: Draft = { title: "", description: "", discountType: "PERCENT", amount: "15", serviceIds: [], categories: [], firstVisitOnly: false, startsOn: "", endsOn: "", active: true };

export default function OffersManager() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [services, setServices] = useState<Svc[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([api<{ offers: Offer[] }>("/api/offers"), api<{ services: Svc[] }>("/api/services")]);
    setOffers(o.offers);
    setServices(s.services);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const categories = [...new Set(services.map((s) => s.category))];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    const value = draft.discountType === "AMOUNT" ? Math.round(Number(draft.amount) * 100) : Math.round(Number(draft.amount));
    const body = {
      title: draft.title,
      description: draft.description,
      discountType: draft.discountType,
      value,
      serviceIds: draft.serviceIds,
      categories: draft.categories,
      firstVisitOnly: draft.firstVisitOnly,
      startsOn: draft.startsOn || null,
      endsOn: draft.endsOn || null,
      active: draft.active,
    };
    try {
      await api(draft.id ? `/api/offers/${draft.id}` : "/api/offers", { method: draft.id ? "PATCH" : "POST", body });
      setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(o: Offer) {
    if (!window.confirm(`Delete the offer "${o.title}"? Past bookings keep the discount they got.`)) return;
    try {
      await api(`/api/offers/${o.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      <div className="spread">
        <div>
          <h1>Offers</h1>
          <p className="muted">Clients see live offers after logging in, and the best one is applied automatically when they book.</p>
        </div>
        <button className="btn" onClick={() => setDraft({ ...EMPTY })}>New offer</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {draft && (
        <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.4rem" }}>{draft.id ? "Edit offer" : "New offer"}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="field"><label htmlFor="o-title">Title</label><input id="o-title" type="text" required maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Glow Season — 20% off facials" /></div>
            <div className="field">
              <label htmlFor="o-type">Discount</label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <select id="o-type" value={draft.discountType} onChange={(e) => setDraft({ ...draft, discountType: e.target.value as "PERCENT" | "AMOUNT" })} style={{ width: 130 }}>
                  <option value="PERCENT">% off</option>
                  <option value="AMOUNT">$ off</option>
                </select>
                <input type="number" min={1} step={draft.discountType === "AMOUNT" ? 0.01 : 1} max={draft.discountType === "PERCENT" ? 90 : undefined} required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} aria-label="Discount amount" />
              </div>
            </div>
            <div className="field"><label htmlFor="o-start">Starts (optional)</label><input id="o-start" type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} /></div>
            <div className="field"><label htmlFor="o-end">Ends (optional)</label><input id="o-end" type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="o-desc">Description</label><textarea id="o-desc" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="field">
            <label>Applies to categories (leave everything empty for all services)</label>
            <div className="weekdays">
              {categories.map((c) => (
                <label key={c}><input type="checkbox" checked={draft.categories.includes(c)} onChange={() => setDraft({ ...draft, categories: toggle(draft.categories, c) })} />{c}</label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>…or specific services</label>
            <div className="weekdays">
              {services.map((s) => (
                <label key={s.id}><input type="checkbox" checked={draft.serviceIds.includes(s.id)} onChange={() => setDraft({ ...draft, serviceIds: toggle(draft.serviceIds, s.id) })} />{s.name}</label>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginBottom: 16 }}>
            <label className="choice" style={{ padding: 10 }}><input type="checkbox" checked={draft.firstVisitOnly} onChange={(e) => setDraft({ ...draft, firstVisitOnly: e.target.checked })} /> First visit only</label>
            <label className="choice" style={{ padding: 10 }}><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
          </div>
          <div className="row">
            <button className="btn">Save offer</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="grid">
        {offers.map((o) => (
          <div key={o.id} className="card" style={{ opacity: o.live ? 1 : 0.6 }}>
            <div className="spread">
              <span className="tag tag-gold" style={{ fontSize: "0.9rem" }}>{o.label}</span>
              <span className={`tag ${o.live ? "tag-ok" : ""}`}>{o.live ? "Live" : o.active ? "Scheduled / ended" : "Off"}</span>
            </div>
            <h3 style={{ margin: "10px 0 4px" }}>{o.title}</h3>
            <p className="small muted">{o.description}</p>
            <div className="small">
              {o.appliesToAll ? "All services" : o.appliesTo.map((s) => s.name).join(", ") || "No matching services"}
              {o.firstVisitOnly && " · first visit only"}
            </div>
            <div className="small muted">{o.startsOn ? `From ${formatDate(o.startsOn)} ` : ""}{o.endsOn ? `until ${formatDate(o.endsOn)}` : "No end date"}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() =>
                  setDraft({
                    id: o.id,
                    title: o.title,
                    description: o.description,
                    discountType: o.discountType,
                    amount: o.discountType === "AMOUNT" ? (o.value / 100).toFixed(2) : String(o.value),
                    serviceIds: o.serviceIds,
                    categories: o.categories,
                    firstVisitOnly: o.firstVisitOnly,
                    startsOn: o.startsOn ?? "",
                    endsOn: o.endsOn ?? "",
                    active: o.active,
                  })
                }
              >
                Edit
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => remove(o)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
