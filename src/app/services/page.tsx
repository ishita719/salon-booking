import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryIcon } from "@/components/Icons";
import { getDb, schema } from "@/db";
import { BOOKING_RULES } from "@/lib/config";
import { formatDuration, formatMoney } from "@/lib/time";

export const metadata: Metadata = { title: "Services & prices" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await getDb()
    .select()
    .from(schema.services)
    .where(eq(schema.services.active, true))
    .orderBy(asc(schema.services.category), asc(schema.services.priceCents));
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <>
      <section className="hero" style={{ padding: "56px 0 40px" }}>
        <div className="container">
          <div className="eyebrow">Services &amp; prices</div>
          <h1>Our <span>menu</span></h1>
          <p className="lead">Prices in CAD, before tax. Don&apos;t see what you need? Add your own request when booking and your stylist will quote it at the visit.</p>
          <div className="row" style={{ marginTop: 18 }}>
            {categories.map((c) => <a key={c} href={`#${encodeURIComponent(c)}`} className="chip" style={{ textDecoration: "none", color: "var(--text)" }}>{c}</a>)}
          </div>
        </div>
      </section>
      <div className="container" style={{ paddingBottom: 40 }}>
        {categories.map((cat) => (
          <section key={cat} id={encodeURIComponent(cat)} style={{ paddingTop: 36, scrollMarginTop: 90 }}>
            <div className="row" style={{ marginBottom: 16 }}>
              <span className="cat-icon"><CategoryIcon category={cat} /></span>
              <h2 style={{ margin: 0 }}>{cat}</h2>
            </div>
            <div className="grid">
              {services.filter((s) => s.category === cat).map((s) => (
                <div key={s.id} className="card card-hover" style={{ display: "flex", flexDirection: "column" }}>
                  <div className="spread" style={{ alignItems: "flex-start" }}>
                    <h3 style={{ margin: 0 }}>{s.name}</h3>
                    <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", color: "var(--brand)" }}>{formatMoney(s.priceCents)}</strong>
                  </div>
                  <p className="muted small" style={{ margin: "8px 0 14px", flex: 1 }}>{s.description}</p>
                  <div className="spread">
                    <div className="row small" style={{ gap: 6 }}>
                      <span className="chip">⏱ {formatDuration(s.durationMin)}</span>
                      <span className="chip">{s.homeAvailable ? "⌂ Studio or home" : "Studio only"}</span>
                    </div>
                    <Link href="/book" className="btn btn-sm btn-outline">Book</Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        <p className="muted small" style={{ marginTop: 32 }}>
          Custom requests reserve {BOOKING_RULES.customServiceDurationMin} minutes and are priced by your stylist at the visit.
        </p>
      </div>
    </>
  );
}
