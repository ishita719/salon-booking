import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING_RULES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDuration, formatMoney } from "@/lib/time";

export const metadata: Metadata = { title: "Services & prices" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const services = await prisma.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { priceCents: "asc" }] });
  const byCategory = services.reduce<Record<string, typeof services>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <h1>Services &amp; prices</h1>
          <p className="muted">Prices in CAD, before tax. Don&apos;t see what you need? Add your own request when booking.</p>
        </div>
        <Link href="/book" className="btn">Book now</Link>
      </div>
      {Object.entries(byCategory).map(([cat, list]) => (
        <section key={cat} style={{ marginTop: 32 }}>
          <h2>{cat}</h2>
          <div className="grid">
            {list.map((s) => (
              <div key={s.id} className="card">
                <div className="spread">
                  <h3 style={{ margin: 0 }}>{s.name}</h3>
                  <strong>{formatMoney(s.priceCents)}</strong>
                </div>
                <p className="muted small" style={{ margin: "6px 0 10px" }}>{s.description}</p>
                <div className="row small">
                  <span className="chip">{formatDuration(s.durationMin)}</span>
                  <span className="chip">{s.homeAvailable ? "Salon or at home" : "Salon only"}</span>
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
  );
}
