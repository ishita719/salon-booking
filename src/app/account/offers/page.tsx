import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { pageUser } from "@/lib/auth";
import { isFirstVisit, liveOffers, serializeOffer } from "@/lib/offers";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "My offers" };
export const dynamic = "force-dynamic";

export default async function ClientOffers() {
  const user = await pageUser(["CUSTOMER"]);
  const db = getDb();
  const [offers, first, services] = await Promise.all([
    liveOffers(db),
    isFirstVisit(db, user.id),
    db.select({ id: schema.services.id, name: schema.services.name, category: schema.services.category }).from(schema.services).where(eq(schema.services.active, true)),
  ]);
  const mine = offers.filter((o) => !o.firstVisitOnly || first).map((o) => serializeOffer(o, services));

  return (
    <div className="container section">
      <div className="eyebrow">Members only</div>
      <h1>Your offers</h1>
      <p className="lead">Offers are applied automatically when you book — the best one for your services is picked for you.</p>
      {mine.length === 0 ? (
        <div className="card center muted" style={{ marginTop: 20 }}>No offers right now — check back soon!</div>
      ) : (
        <div className="grid" style={{ marginTop: 20 }}>
          {mine.map((o, i) => (
            <div key={o.id} className={`offer-card ${i % 3 === 1 ? "alt" : i % 3 === 2 ? "gold" : ""}`}>
              <div className="big">{o.label}</div>
              <strong>{o.title}</strong>
              <p className="small" style={{ margin: "8px 0" }}>{o.description}</p>
              <div className="small">
                {o.appliesToAll ? "On all services" : `On: ${o.appliesTo.map((s) => s.name).join(", ")}`}
                {o.firstVisitOnly && " · first visit only"}
                {o.endsOn && ` · until ${formatDate(o.endsOn)}`}
              </div>
              <Link href={o.appliesTo.length === 1 ? `/book?service=${o.appliesTo[0].id}` : "/book"} className="btn btn-light btn-sm" style={{ marginTop: 14, position: "relative", zIndex: 1 }}>Book with this offer</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
