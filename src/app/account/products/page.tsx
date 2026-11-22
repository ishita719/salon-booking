import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { pageUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/recommend";
import { matchItem } from "@/lib/skin";
import { formatMoney } from "@/lib/time";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ClientProducts() {
  const user = await pageUser(["CUSTOMER"]);
  const db = getDb();
  const [products, recs] = await Promise.all([
    db.select().from(schema.products).where(eq(schema.products.active, true)).orderBy(asc(schema.products.category), asc(schema.products.name)),
    getRecommendations(db, user.id),
  ]);
  const a = recs.analysis;
  const rows = products
    .map((p) => ({ p, m: a ? matchItem(p.targets, a) : { score: 0, reasons: [] as string[] } }))
    .sort((x, y) => y.m.score - x.m.score);

  return (
    <div className="container section">
      <div className="eyebrow">Salon shelf</div>
      <h1>Products</h1>
      <p className="lead">
        {a ? <>Sorted for <strong>{a.headline.toLowerCase()}</strong> — best matches first.</> : <>Take the <Link href="/account/skin-check">skin check</Link> to see which products suit you best.</>}
      </p>
      <div className="grid" style={{ marginTop: 20 }}>
        {rows.map(({ p, m }) => (
          <div key={p.id} className="card" style={{ borderColor: m.score > 0 ? "var(--rose)" : undefined }}>
            <div className="spread">
              <span className="tag">{p.category}</span>
              {m.score > 0 && <span className="tag tag-ok">✓ Matches your skin</span>}
            </div>
            <h3 style={{ margin: "10px 0 2px" }}>{p.name}</h3>
            <div className="small muted">{p.brand}</div>
            <p className="small" style={{ margin: "8px 0" }}>{p.description}</p>
            {p.howToUse && <div className="small"><strong>How to use:</strong> {p.howToUse}</div>}
            {m.reasons.length > 0 && <div className="small muted" style={{ marginTop: 6 }}>Good for: {m.reasons.join(", ")}</div>}
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 700, marginTop: 10 }}>{formatMoney(p.priceCents)}</div>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>Available at the salon — ask your stylist at your next visit.</p>
    </div>
  );
}
