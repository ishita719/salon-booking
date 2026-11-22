import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/Icons";
import Stars from "@/components/Stars";
import { getDb, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { stepsOf } from "@/lib/content";
import { isFirstVisit, liveOffers, priceWithOffer } from "@/lib/offers";
import { matchItem, TARGETS, Target } from "@/lib/skin";
import { formatDuration, formatMoney } from "@/lib/time";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const s = await getDb().query.services.findFirst({ where: eq(schema.services.id, id), columns: { name: true } });
  return { title: s?.name ?? "Service" };
}

export default async function ServiceDetail({ params }: Props) {
  const { id } = await params;
  const db = getDb();
  const s = await db.query.services.findFirst({ where: and(eq(schema.services.id, id), eq(schema.services.active, true)) });
  if (!s) notFound();

  const user = await getSessionUser();
  const client = user?.role === "CUSTOMER";
  const targets = s.targets.split(",").filter((t) => t && t !== "strong") as Target[];

  const [offers, firstVisit, products, ratings] = await Promise.all([
    client ? liveOffers(db) : Promise.resolve([]),
    client ? isFirstVisit(db, user!.id) : Promise.resolve(false),
    db.select().from(schema.products).where(eq(schema.products.active, true)),
    db
      .select({ rating: schema.feedback.rating })
      .from(schema.feedback)
      .innerJoin(schema.appointmentItems, eq(schema.appointmentItems.appointmentId, schema.feedback.appointmentId))
      .where(eq(schema.appointmentItems.serviceId, s.id)),
  ]);
  const offer = client ? priceWithOffer(offers, s, firstVisit) : null;
  const pairing = products
    .map((p) => ({ p, ...matchItem(p.targets, { needs: targets, sensitivity: "low" }) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const avg = ratings.length ? ratings.reduce((t, r) => t + r.rating, 0) / ratings.length : null;

  return (
    <>
      <section className="hero" style={{ padding: "48px 0 36px" }}>
        <div className="container">
          <Link href="/services" className="small">← All services</Link>
          <div className="row" style={{ marginTop: 14 }}>
            <span className="cat-icon"><CategoryIcon category={s.category} /></span>
            <div className="eyebrow" style={{ margin: 0 }}>{s.category}</div>
          </div>
          <h1 style={{ marginTop: 10 }}>{s.name}</h1>
          <p className="lead">{s.description}</p>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="chip">⏱ {formatDuration(s.durationMin)}</span>
            <span className="chip">{s.homeAvailable ? "⌂ Studio or at home" : "Studio only"}</span>
            {avg && <span className="chip"><Stars rating={avg} size="0.9rem" /> {avg.toFixed(1)} ({ratings.length})</span>}
          </div>
        </div>
      </section>

      <div className="container dash-cols" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <section className="card">
          <h2 style={{ fontSize: "1.5rem" }}>How it&apos;s done</h2>
          {stepsOf(s.steps).length ? (
            <ol className="timeline" style={{ marginTop: 18 }}>
              {stepsOf(s.steps).map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          ) : (
            <p className="muted">Your stylist will walk you through every step at your visit.</p>
          )}
          {targets.length > 0 && (
            <>
              <h3 style={{ marginTop: 10 }}>Great for</h3>
              <div className="tags">{targets.map((t) => <span key={t} className="tag">{TARGETS[t]}</span>)}</div>
            </>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="muted small">Price</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 700 }}>
              {offer ? (<><span className="price-was">{formatMoney(s.priceCents)}</span><span className="price-now">{formatMoney(offer.priceCents)}</span></>) : formatMoney(s.priceCents)}
            </div>
            {offer && <div className="tag tag-gold" style={{ marginBottom: 10 }}>{offer.label} · {offer.offerTitle}</div>}
            {!client && <p className="small muted">Members see their personal offers here. <Link href="/login">Log in</Link></p>}
            <Link href="/book" className="btn btn-block" style={{ marginTop: 8 }}>Book this service</Link>
            <Link href="/account/skin-check" className="btn btn-ghost btn-block" style={{ marginTop: 8 }}>Not sure? Take the skin check</Link>
          </section>
          {pairing.length > 0 && (
            <section className="card">
              <h3>Pairs well with</h3>
              {pairing.map(({ p }) => (
                <div key={p.id} className="spread" style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                  <div><strong className="small">{p.name}</strong><div className="small muted">{p.category}</div></div>
                  <span className="small">{formatMoney(p.priceCents)}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
