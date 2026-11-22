"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SlotPicker from "@/components/SlotPicker";
import { api } from "@/lib/client";
import { bestOffer, OfferLike, offerLabel } from "@/lib/offer-math";
import { formatDate, formatDuration, formatMoney, formatTime } from "@/lib/time";

interface Service {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  homeAvailable: boolean;
}

interface Props {
  services: Service[];
  stylists: { id: string; name: string; title: string }[];
  minDate: string;
  maxDate: string;
  rules: { customDurationMin: number; maxServices: number; travelFeeCents: number; areaLabel: string; cutoffHours: number };
  teamMode?: boolean; // staff/owner booking on behalf of a client
  defaultStylistId?: string;
  doneHref: string;
  recommendedIds?: string[]; // from the client's skin check
  offers?: OfferLike[]; // live offers this client can use
  firstVisit?: boolean;
  payOnlineAvailable?: boolean;
  initialServiceId?: string;
}

export default function BookingForm({ services, stylists, minDate, maxDate, rules, teamMode, defaultStylistId = "", doneHref, recommendedIds = [], offers = [], firstVisit = false, payOnlineAvailable = false, initialServiceId }: Props) {
  const router = useRouter();
  const [client, setClient] = useState({ name: "", phone: "", email: "" });
  const [selected, setSelected] = useState<string[]>(initialServiceId && services.some((s) => s.id === initialServiceId) ? [initialServiceId] : []);
  const [payOnline, setPayOnline] = useState(false);
  const [custom, setCustom] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [location, setLocation] = useState<"SALON" | "HOME">("SALON");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [stylistId, setStylistId] = useState(defaultStylistId);
  const [date, setDate] = useState("");
  const [startMin, setStartMin] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byCategory = useMemo(() => {
    const m: Record<string, Service[]> = {};
    const rec = services.filter((s) => recommendedIds.includes(s.id));
    if (rec.length) m["✦ Recommended for you"] = rec;
    for (const s of services) if (!recommendedIds.includes(s.id)) (m[s.category] ??= []).push(s);
    return m;
  }, [services, recommendedIds]);

  const chosen = services.filter((s) => selected.includes(s.id));
  const count = chosen.length + custom.length;
  const duration = chosen.reduce((t, s) => t + s.durationMin, 0) + custom.length * rules.customDurationMin;
  const subtotal = chosen.reduce((t, s) => t + s.priceCents, 0);
  const travel = location === "HOME" ? rules.travelFeeCents : 0;
  const offer = teamMode ? null : bestOffer(offers, chosen, firstVisit);
  const discount = offer?.discountCents ?? 0;
  const total = subtotal + travel - discount;
  const singleOffer = (s: Service) => (teamMode ? null : bestOffer(offers, [s], firstVisit));

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : count < rules.maxServices ? [...cur, id] : cur));
  }

  function addCustom() {
    const v = customInput.trim();
    if (v.length < 2 || custom.length >= 3 || count >= rules.maxServices) return;
    setCustom([...custom, v.slice(0, 80)]);
    setCustomInput("");
  }

  function chooseLocation(l: "SALON" | "HOME") {
    setLocation(l);
    if (l === "HOME") setSelected((cur) => cur.filter((id) => services.find((s) => s.id === id)?.homeAvailable));
  }

  async function submit() {
    setError(null);
    if (teamMode && (client.name.trim().length < 2 || client.phone.trim().length < 7)) return setError("Enter the client's name and phone number.");
    if (!count) return setError("Choose at least one service.");
    if (!date || startMin == null) return setError("Choose a date and time.");
    setBusy(true);
    try {
      const res = await api("/api/appointments", {
        method: "POST",
        body: {
          serviceIds: selected,
          customServices: custom,
          locationType: location,
          address: location === "HOME" ? address : undefined,
          postalCode: location === "HOME" ? postalCode : undefined,
          stylistId: stylistId || null,
          date,
          startMin,
          notes: notes || undefined,
          client: teamMode ? client : undefined,
          payOnline: !teamMode && payOnline,
        },
      });
      const r = res as { checkoutUrl?: string | null; paymentNote?: string | null };
      if (r.checkoutUrl) {
        window.location.href = r.checkoutUrl; // Stripe's secure payment page
        return;
      }
      router.push(r.paymentNote ? `${doneHref}&payment=pending` : doneHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="book-layout" style={{ marginTop: 24 }}>
      <div className="stack">
        {teamMode && (
          <section className="card">
            <div className="step-title"><span className="step-num">★</span><h2 style={{ margin: 0 }}>Client</h2></div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="field"><label htmlFor="c-name">Name</label><input id="c-name" type="text" maxLength={80} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="c-phone">Phone</label><input id="c-phone" type="tel" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></div>
              <div className="field">
                <label htmlFor="c-email">Email (optional)</label>
                <input id="c-email" type="email" maxLength={120} value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
                <div className="hint">For a confirmation email.</div>
              </div>
            </div>
          </section>
        )}
        {/* 1. Services */}
        <section className="card">
          <div className="step-title"><span className="step-num">1</span><h2 style={{ margin: 0 }}>Services</h2></div>
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <h3>{cat}</h3>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
                {list.map((s) => {
                  const disabled = location === "HOME" && !s.homeAvailable;
                  const on = selected.includes(s.id);
                  return (
                    <label key={s.id} className={`choice ${on ? "selected" : ""} ${disabled ? "disabled" : ""}`}>
                      <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(s.id)} />
                      <span>
                        <span className="title">{s.name}</span>
                        {recommendedIds.includes(s.id) && cat !== "✦ Recommended for you" && <span className="tag tag-gold" style={{ marginLeft: 6 }}>For you</span>}
                        <br />
                        <span className="small muted">
                          {formatDuration(s.durationMin)} ·{" "}
                          {singleOffer(s) ? (
                            <><span className="price-was">{formatMoney(s.priceCents)}</span><span className="price-now">{formatMoney(s.priceCents - singleOffer(s)!.discountCents)}</span></>
                          ) : (
                            formatMoney(s.priceCents)
                          )}
                          {disabled && " · salon only"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="custom">Need something not listed?</label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input
                id="custom"
                type="text"
                maxLength={80}
                placeholder="e.g. Hair extensions consultation"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
              />
              <button type="button" className="btn btn-ghost" onClick={addCustom} disabled={customInput.trim().length < 2}>Add</button>
            </div>
            <div className="hint">We reserve {rules.customDurationMin} min and your stylist quotes the price at the visit.</div>
            {custom.length > 0 && (
              <div className="row" style={{ marginTop: 10 }}>
                {custom.map((c, i) => (
                  <span key={i} className="chip">
                    {c}
                    <button type="button" aria-label={`Remove ${c}`} onClick={() => setCustom(custom.filter((_, j) => j !== i))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 2. Location */}
        <section className="card">
          <div className="step-title"><span className="step-num">2</span><h2 style={{ margin: 0 }}>Where</h2></div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <label className={`choice ${location === "SALON" ? "selected" : ""}`}>
              <input type="radio" name="loc" checked={location === "SALON"} onChange={() => chooseLocation("SALON")} />
              <span><span className="title">In our studio</span><br /><span className="small muted">Main Street, Vancouver</span></span>
            </label>
            <label className={`choice ${location === "HOME" ? "selected" : ""}`}>
              <input type="radio" name="loc" checked={location === "HOME"} onChange={() => chooseLocation("HOME")} />
              <span><span className="title">At my home</span><br /><span className="small muted">+{formatMoney(rules.travelFeeCents)} travel fee</span></span>
            </label>
          </div>
          {location === "HOME" && (
            <div style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="address">Street address</label>
                <input id="address" type="text" maxLength={200} autoComplete="street-address" placeholder="Unit, street, city" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
                <label htmlFor="postal">Postal code</label>
                <input id="postal" type="text" maxLength={7} autoComplete="postal-code" placeholder="V6B 1A1" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
              <div className="hint">We travel to {rules.areaLabel}.</div>
            </div>
          )}
        </section>

        {/* 3. Stylist + time */}
        <section className="card">
          <div className="step-title"><span className="step-num">3</span><h2 style={{ margin: 0 }}>Stylist &amp; time</h2></div>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="stylist">Stylist</label>
            <select id="stylist" value={stylistId} onChange={(e) => { setStylistId(e.target.value); setStartMin(null); }}>
              <option value="">Any available stylist</option>
              {stylists.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.title}</option>
              ))}
            </select>
          </div>
          <SlotPicker
            minDate={minDate}
            maxDate={maxDate}
            durationMin={duration}
            location={location}
            stylistId={stylistId}
            date={date}
            startMin={startMin}
            onChange={(d, s) => { setDate(d); setStartMin(s); }}
          />
        </section>

        {/* 4. Notes */}
        <section className="card">
          <div className="step-title"><span className="step-num">4</span><h2 style={{ margin: 0 }}>Anything we should know?</h2></div>
          <textarea maxLength={500} placeholder="Allergies, hair history, parking or buzzer info…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>
      </div>

      {/* Summary */}
      <aside className="card summary">
        <h2>Summary</h2>
        {count === 0 ? (
          <p className="muted">No services chosen yet.</p>
        ) : (
          <ul style={{ paddingLeft: 18, margin: "0 0 12px" }}>
            {chosen.map((s) => <li key={s.id}>{s.name} — {formatMoney(s.priceCents)}</li>)}
            {custom.map((c, i) => <li key={i}>{c} — <em>quote</em></li>)}
          </ul>
        )}
        <div className="small muted">Duration: {duration ? formatDuration(duration) : "—"}</div>
        <div className="small muted">Where: {location === "HOME" ? "At home" : "In studio"}</div>
        <div className="small muted">When: {date && startMin != null ? `${formatDate(date)}, ${formatTime(startMin)}` : "—"}</div>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "14px 0" }} />
        {subtotal > 0 && <div className="spread small"><span>Services</span><span>{formatMoney(subtotal)}</span></div>}
        {travel > 0 && <div className="spread small"><span>Travel fee</span><span>{formatMoney(travel)}</span></div>}
        {offer && (
          <div className="spread small" style={{ color: "var(--ok)" }}>
            <span>✦ {offer.offer.title} ({offerLabel(offer.offer)})</span>
            <span>−{formatMoney(discount)}</span>
          </div>
        )}
        <div className="spread" style={{ marginTop: 6 }}><strong>Total</strong><strong style={{ fontSize: "1.2rem" }}>{formatMoney(total)}{custom.length ? " + quote" : ""}</strong></div>
        {!teamMode && payOnlineAvailable && total > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>How would you like to pay?</div>
            <div className="pay-choice">
              <label className={`choice ${payOnline ? "selected" : ""}`} style={{ padding: 10 }}>
                <input type="radio" name="pay" checked={payOnline} onChange={() => setPayOnline(true)} />
                <span><span className="title small">💳 Pay online now</span><br /><span className="small muted">Card, Apple Pay, Google Pay</span></span>
              </label>
              <label className={`choice ${!payOnline ? "selected" : ""}`} style={{ padding: 10 }}>
                <input type="radio" name="pay" checked={!payOnline} onChange={() => setPayOnline(false)} />
                <span><span className="title small">At the salon</span><br /><span className="small muted">Pay after your visit</span></span>
              </label>
            </div>
          </div>
        )}
        {teamMode && client.name && <div className="small muted">For: {client.name}</div>}
        <p className="small muted" style={{ marginTop: 8 }}>
          {teamMode ? "Paid at the visit." : payOnline ? "You'll be taken to Stripe's secure page to pay. Your card details never touch our site." : `Pay at your visit. Free changes up to ${rules.cutoffHours} h before.`}
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <button className="btn" style={{ width: "100%" }} onClick={submit} disabled={busy || !count || startMin == null}>
          {busy ? "Booking…" : payOnline ? `Book & pay ${formatMoney(total)}` : "Confirm booking"}
        </button>
      </aside>
    </div>
  );
}
