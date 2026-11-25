import type { Metadata } from "next";
import Link from "next/link";
import { pageUser } from "@/lib/auth";
import { getInsights } from "@/lib/insights";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

function HBars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="muted small">No data yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="hbar">
          <span>{r.label}</span>
          <span className="track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <strong>{r.n}</strong>
        </div>
      ))}
    </div>
  );
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await pageUser(["OWNER"]);
  const d = Number((await searchParams).days);
  const days = d === 7 || d === 90 ? d : 30;
  const s = await getInsights(days);
  const maxV = Math.max(1, ...s.series.map((x) => x.visitors));
  const maxB = Math.max(1, ...s.series.map((x) => x.bookings));

  const cards = [
    { label: "Site visitors", value: s.visitors, hint: `${s.pageViews} page views` },
    { label: "Bookings made", value: s.bookingsMade, hint: `${s.onlineBookings} online · ${s.salonBookings} by salon` },
    { label: "Visit → booking", value: s.conversion, hint: "online bookings ÷ visitors" },
    { label: "New clients", value: s.newClients, hint: "accounts created" },
    { label: "Revenue", value: s.revenue, hint: `${s.completedVisits} completed visits` },
    { label: "Average ticket", value: s.avgTicket, hint: "per completed visit" },
    { label: "Booked value", value: s.bookedValue, hint: `${s.visitsInPeriod} visits in period` },
    { label: "Repeat clients", value: s.repeatRate, hint: `${s.repeatClients} came back 2+ times` },
  ];

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <div className="eyebrow">Owner</div>
          <h1 style={{ marginBottom: 4 }}>Insights</h1>
          <p className="muted">{formatDate(s.from)} – {formatDate(s.to)}</p>
        </div>
        <div className="row">
          {[7, 30, 90].map((n) => (
            <Link key={n} href={`/owner/insights?days=${n}`} className={`btn btn-sm ${n === days ? "" : "btn-ghost"}`}>{n} days</Link>
          ))}
          <a href={`/api/owner/export?days=${days}`} className="btn btn-sm btn-outline">⬇ Export CSV</a>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", marginTop: 20 }}>
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="muted small">{c.label}</div>
            <div className="stat">{c.value}</div>
            <div className="small muted">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="visit-cols" style={{ marginTop: 24 }}>
        <section className="card">
          <h3>Visitors per day</h3>
          <div className="bars" aria-label="Visitors per day">
            {s.series.map((x) => <span key={x.date} className="bar" style={{ height: `${Math.max(2, (x.visitors / maxV) * 100)}%` }} data-tip={`${formatDate(x.date)}: ${x.visitors} visitors`} />)}
          </div>
          <div className="spread small muted"><span>{formatDate(s.from)}</span><span>Today</span></div>
        </section>
        <section className="card">
          <h3>Bookings made per day</h3>
          <div className="bars" aria-label="Bookings per day">
            {s.series.map((x) => <span key={x.date} className="bar alt" style={{ height: `${Math.max(2, (x.bookings / maxB) * 100)}%` }} data-tip={`${formatDate(x.date)}: ${x.bookings} bookings`} />)}
          </div>
          <div className="spread small muted"><span>{formatDate(s.from)}</span><span>Today</span></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="spread"><h2 style={{ fontSize: "1.5rem", margin: 0 }}>Services booked &amp; charges</h2><span className="small muted">Bookings made in this period (not cancelled)</span></div>
        {s.services.length === 0 ? (
          <p className="muted">No bookings in this period yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>Service</th><th>Times booked</th><th>Charges booked</th><th>Earned (completed)</th><th>Average price</th></tr></thead>
              <tbody>
                {s.services.map((r) => (
                  <tr key={r.name}><td><strong>{r.name}</strong></td><td>{r.bookings}</td><td>{r.charges}</td><td>{r.completed}</td><td>{r.avg}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <section className="card">
          <h3>Payments</h3>
          <table><tbody>
            <tr><td>Paid online</td><td><strong>{s.payments.online}</strong></td></tr>
            <tr><td>Paid at salon</td><td><strong>{s.payments.salon}</strong></td></tr>
            <tr><td>Still to collect (completed, unpaid)</td><td><strong>{s.payments.outstanding}</strong></td></tr>
            <tr><td>Refunded</td><td>{s.payments.refunded}</td></tr>
            <tr><td>Discounts given</td><td>{s.discounts}</td></tr>
          </tbody></table>
        </section>
        <section className="card">
          <h3>Offers used</h3>
          {s.offers.length === 0 ? <p className="muted small">No offers used in this period.</p> : (
            <table><thead><tr><th>Offer</th><th>Uses</th><th>Discount</th></tr></thead><tbody>
              {s.offers.map((o) => <tr key={o.title}><td>{o.title}</td><td>{o.uses}</td><td>{o.discount}</td></tr>)}
            </tbody></table>
          )}
          <Link href="/owner/offers" className="small">Manage offers →</Link>
        </section>
        <section className="card">
          <h3>Visits overview</h3>
          <table><tbody>
            <tr><td>Completed</td><td><strong>{s.completedVisits}</strong></td></tr>
            <tr><td>At-home visits</td><td>{s.homeVisits}</td></tr>
            <tr><td>Cancelled</td><td>{s.cancelled}</td></tr>
            <tr><td>No-shows</td><td>{s.noShows}</td></tr>
          </tbody></table>
        </section>
        <section className="card"><h3>Busiest days</h3><HBars rows={s.byDay} /></section>
        <section className="card"><h3>Busiest start times</h3><HBars rows={s.byHour} /></section>
        <section className="card">
          <h3>Most visited pages</h3>
          <HBars rows={s.topPages.map((p) => ({ label: p.path, n: p.views }))} />
        </section>
        <section className="card">
          <h3>Skin checks ({s.skinChecks})</h3>
          <div className="small muted" style={{ marginBottom: 6 }}>Skin types</div>
          <HBars rows={s.skinTypes} />
          <div className="small muted" style={{ margin: "10px 0 6px" }}>Top concerns — great ideas for your next offer</div>
          <HBars rows={s.topConcerns} />
        </section>
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>Visitors are counted anonymously (a random ID per browser). Your team&apos;s own pages are not counted.</p>
    </div>
  );
}
