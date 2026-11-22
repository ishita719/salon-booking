import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/AppointmentCard";
import Stars from "@/components/Stars";
import { pageUser } from "@/lib/auth";
import { getStaffCode } from "@/lib/settings";
import { getOwnerStats } from "@/lib/stats";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Owner dashboard" };
export const dynamic = "force-dynamic";

export default async function OwnerDashboard() {
  const user = await pageUser(["OWNER"]);
  const [s, staffCode] = await Promise.all([getOwnerStats(), getStaffCode()]);

  const cards = [
    { label: "Revenue this month", value: s.revenueMonth, hint: "completed visits" },
    { label: "Booked revenue ahead", value: s.expectedMonth, hint: "rest of this month" },
    { label: "Visitors today", value: s.visitorsToday, hint: "people on the website" },
    { label: "Today", value: s.todayCount, hint: "appointments" },
    { label: "Next 7 days", value: s.weekCount, hint: "appointments" },
    { label: "Upcoming", value: s.upcomingCount, hint: "all future bookings" },
    { label: "New clients", value: s.newClients, hint: "signed up this month" },
    { label: "Client rating", value: s.avgRating === "—" ? "—" : `${s.avgRating} ★`, hint: `${s.reviewCount} review${s.reviewCount === 1 ? "" : "s"}` },
    { label: "No-show rate", value: s.noShowRate, hint: `${s.cancelled} cancellations this month` },
  ];

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <div className="eyebrow">Owner dashboard</div>
          <h1 style={{ marginBottom: 4 }}>Good day, {user.name.split(" ")[0]}</h1>
          <p className="muted">{formatDate(s.today)} — here&apos;s how the salon is doing.</p>
        </div>
        <div className="row">
          <Link href="/owner/insights" className="btn btn-ghost">📊 Insights</Link>
          <Link href="/owner/appointments" className="btn btn-ghost">All appointments</Link>
          <Link href="/book" className="btn">New booking</Link>
        </div>
      </div>

      {!staffCode && (
        <div className="alert alert-gold spread" style={{ marginTop: 16 }}>
          <span><strong>Set a staff code</strong> so your team can create accounts and log in.</span>
          <Link href="/owner/team" className="btn btn-sm btn-gold">Set staff code</Link>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", marginTop: 20 }}>
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="muted small">{c.label}</div>
            <div className="stat">{c.value}</div>
            <div className="small muted">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols" style={{ marginTop: 24 }}>
        <section className="card">
          <div className="spread">
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Today&apos;s schedule</h2>
            <Link href="/owner/appointments" className="small">Manage →</Link>
          </div>
          {s.todaySchedule.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>No appointments today.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr><th>Time</th><th>Client</th><th>Services</th><th>Stylist</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {s.todaySchedule.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{a.timeLabel}</td>
                      <td>{a.customer.name}<div className="small muted">{a.customer.phone}</div></td>
                      <td>{a.items.map((i) => i.name).join(", ")}{a.locationType === "HOME" && <div className="small muted">At home · {a.postalCode}</div>}</td>
                      <td>{a.stylist?.name ?? "—"}</td>
                      <td><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="spread">
              <h3 style={{ margin: 0 }}>Latest feedback</h3>
              <Link href="/owner/feedback" className="small">All feedback →</Link>
            </div>
            {s.latestFeedback.length === 0 ? (
              <p className="muted small" style={{ marginTop: 10 }}>No feedback yet. Clients can rate their visits from their account.</p>
            ) : (
              s.latestFeedback.map((f) => (
                <div key={f.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
                  <div className="spread"><strong className="small">{f.name}</strong><Stars rating={f.rating} size="0.9rem" /></div>
                  {f.comment && <div className="small muted">“{f.comment.length > 120 ? `${f.comment.slice(0, 120)}…` : f.comment}”</div>}
                </div>
              ))
            )}
          </section>
          <section className="card">
            <h3>Team this month</h3>
            <table>
              <thead><tr><th>Stylist</th><th>Today</th><th>Booked</th><th>Revenue</th></tr></thead>
              <tbody>
                {s.team.map((t) => (
                  <tr key={t.id}><td>{t.name}</td><td>{t.today}</td><td>{t.bookings}</td><td>{t.revenue}</td></tr>
                ))}
              </tbody>
            </table>
            <Link href="/owner/team" className="small" style={{ display: "inline-block", marginTop: 10 }}>Manage team →</Link>
          </section>
          <section className="card">
            <h3>Top services this month</h3>
            {s.topServices.length === 0 ? (
              <p className="muted small">No bookings yet this month.</p>
            ) : (
              <ol style={{ paddingLeft: 20, margin: 0 }}>
                {s.topServices.map((t) => <li key={t.name}>{t.name} <span className="muted small">— {t.count}</span></li>)}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
