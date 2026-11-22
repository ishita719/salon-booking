import { and, asc, eq, gte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { pageUser } from "@/lib/auth";
import { hydrate, serialize } from "@/lib/bookings";
import { getRecommendations } from "@/lib/recommend";
import { salonNow } from "@/lib/time";

export const metadata: Metadata = { title: "For you" };
export const dynamic = "force-dynamic";

// The client's personal home after logging in: next visit, skin profile, picks for them and their offers.
export default async function ClientHome() {
  const user = await pageUser(["CUSTOMER"]);
  const db = getDb();
  const [recs, nextRows] = await Promise.all([
    getRecommendations(db, user.id),
    db
      .select()
      .from(schema.appointments)
      .where(and(eq(schema.appointments.userId, user.id), gte(schema.appointments.date, salonNow().date), inArray(schema.appointments.status, ["BOOKED", "CONFIRMED"])))
      .orderBy(asc(schema.appointments.date), asc(schema.appointments.startMin))
      .limit(1),
  ]);
  const next = nextRows.length ? serialize((await hydrate(db, nextRows))[0]) : null;
  const first = user.name.split(" ")[0];

  return (
    <div className="container section stack">
      <div className="spread">
        <div>
          <div className="eyebrow">Your salon account</div>
          <h1 style={{ marginBottom: 4 }}>Hello, {first} ✦</h1>
          <p className="muted">Everything picked for you — based on your skin check and your visits.</p>
        </div>
        <Link href="/book" className="btn btn-lg">Book an appointment</Link>
      </div>

      <div className="dash-cols">
        <section className="card" style={{ background: next ? undefined : "var(--bg-tint)" }}>
          <div className="eyebrow">Next visit</div>
          {next ? (
            <>
              <h2 style={{ fontSize: "1.6rem", marginBottom: 4 }}>{next.dateLabel}</h2>
              <div className="muted">{next.timeLabel} · {next.locationType === "HOME" ? "At home" : "In studio"} · {next.stylist?.name ?? "Stylist TBA"}</div>
              <p style={{ margin: "10px 0" }}>{next.items.map((i) => i.name).join(" + ")}</p>
              <div className="row">
                <span className="tag">{next.totalLabel}</span>
                <span className={`tag ${next.paymentStatus.startsWith("PAID") ? "tag-ok" : ""}`}>{next.paymentLabel}</span>
                {next.offerTitle && <span className="tag tag-gold">{next.offerTitle}</span>}
              </div>
              <Link href="/account/appointments" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>Manage appointments</Link>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: "1.4rem" }}>No upcoming visits</h2>
              <p className="muted">Treat yourself — your member offers are waiting.</p>
              <Link href="/book" className="btn btn-sm">Book now</Link>
            </>
          )}
        </section>

        <section className="card">
          <div className="eyebrow">Your skin profile</div>
          {recs.analysis ? (
            <>
              <h3 style={{ marginBottom: 6 }}>{recs.analysis.headline}</h3>
              <div className="tags" style={{ marginBottom: 12 }}>
                {recs.analysis.concernLabels.slice(0, 4).map((c) => <span key={c} className="tag tag-gold">{c}</span>)}
              </div>
              <Link href="/account/skin-check" className="btn btn-sm btn-outline">See my full results</Link>
            </>
          ) : (
            <>
              <h3>Take your free skin &amp; hair check</h3>
              <p className="muted small">2 minutes · get your routine, the treatments and products that suit you, and personal offers.</p>
              <Link href="/account/skin-check" className="btn btn-sm">Start the check</Link>
            </>
          )}
        </section>
      </div>

      {recs.services.length > 0 && (
        <section>
          <div className="spread"><h2>Recommended for you</h2><Link href="/account/skin-check" className="small">Why these? →</Link></div>
          <div className="grid">
            {recs.services.map((s, i) => (
              <div key={s.id} className="card card-hover">
                {i === 0 && <span className="tag tag-gold" style={{ marginBottom: 8 }}>★ Best match</span>}
                <h3 style={{ marginBottom: 2 }}>{s.name}</h3>
                <div className="small muted">{s.durationLabel} · good for {s.reasons.slice(0, 2).join(" & ").toLowerCase()}</div>
                <div className="spread" style={{ marginTop: 12 }}>
                  <div>{s.offerPriceLabel ? (<><span className="price-was">{s.priceLabel}</span><span className="price-now">{s.offerPriceLabel}</span></>) : <strong>{s.priceLabel}</strong>}</div>
                  <Link href={`/book?service=${s.id}`} className="btn btn-sm">Book</Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recs.offers.length > 0 && (
        <section>
          <div className="spread"><h2>Your offers</h2><Link href="/account/offers" className="small">All offers →</Link></div>
          <div className="grid">
            {recs.offers.slice(0, 3).map((o, i) => (
              <div key={o.id} className={`offer-card ${i === 1 ? "alt" : i === 2 ? "gold" : ""}`}>
                <div className="big">{o.label}</div>
                <strong>{o.title}</strong>
                <p className="small" style={{ margin: "6px 0 0" }}>{o.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {recs.products.length > 0 && (
        <section>
          <div className="spread"><h2>Products for you</h2><Link href="/account/products" className="small">All products →</Link></div>
          <div className="grid">
            {recs.products.slice(0, 3).map((p) => (
              <div key={p.id} className="card">
                <div className="spread"><span className="tag">{p.category}</span><strong>{p.priceLabel}</strong></div>
                <h3 style={{ margin: "10px 0 4px" }}>{p.name}</h3>
                <p className="small muted" style={{ margin: 0 }}>{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Link href="/account/appointments" className="cat-card"><strong>📅 My appointments</strong><span className="small muted">Reschedule, cancel, pay, add to calendar</span></Link>
        <Link href="/account/feedback" className="cat-card"><strong>★ Feedback</strong><span className="small muted">Rate your visits</span></Link>
        <Link href="/gallery" className="cat-card"><strong>✦ Our work</strong><span className="small muted">See results from the studio</span></Link>
        <Link href="/settings" className="cat-card"><strong>⚙ Profile &amp; password</strong><span className="small muted">Update your details</span></Link>
      </div>
    </div>
  );
}
