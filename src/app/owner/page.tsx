import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/AppointmentCard";
import { pageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getOwnerStats } from "@/lib/stats";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Owner dashboard" };
export const dynamic = "force-dynamic";

export default async function OwnerDashboard() {
  const user = await pageUser(["OWNER"]);
  const [s, pendingStaff] = await Promise.all([
    getOwnerStats(),
    prisma.user.count({ where: { role: "STAFF", active: false, stylist: null } }),
  ]);

  const cards = [
    { label: "Revenue this month", value: s.revenueMonth, hint: "completed visits" },
    { label: "Booked revenue ahead", value: s.expectedMonth, hint: "rest of this month" },
    { label: "Today", value: s.todayCount, hint: "appointments" },
    { label: "Next 7 days", value: s.weekCount, hint: "appointments" },
    { label: "Upcoming", value: s.upcomingCount, hint: "all future bookings" },
    { label: "New clients", value: s.newClients, hint: "signed up this month" },
    { label: "No-show rate", value: s.noShowRate, hint: `${s.cancelled} cancellations this month` },
    { label: "Booked online", value: s.onlineShare, hint: `${s.homeVisits} at-home visits this month` },
  ];

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <div className="eyebrow">Owner dashboard</div>
          <h1>Good day, {user.name.split(" ")[0]}</h1>
          <p className="muted">{formatDate(s.today)} — here&apos;s how the salon is doing.</p>
        </div>
        <div className="row">
          <Link href="/owner/appointments" className="btn btn-ghost">All appointments</Link>
          <Link href="/book" className="btn">New booking</Link>
        </div>
      </div>

      {pendingStaff > 0 && (
        <div className="alert alert-info spread" style={{ marginTop: 16 }}>
          <span>
            <strong>{pendingStaff}</strong> staff sign-up request{pendingStaff > 1 ? "s are" : " is"} waiting for your approval.
          </span>
          <Link href="/owner/team" className="btn btn-sm">Review</Link>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", marginTop: 20 }}>
        {cards.map((c) => (
          <div key={c.label} className="card-flat">
            <div className="muted small">{c.label}</div>
            <div className="stat">{c.value}</div>
            <div className="small muted">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="dash-cols" style={{ marginTop: 24 }}>
        <section className="card">
          <div className="spread">
            <h2 style={{ margin: 0 }}>Today&apos;s schedule</h2>
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
            <h2>Team this month</h2>
            <table>
              <thead><tr><th>Stylist</th><th>Today</th><th>Bookings</th><th>Revenue</th></tr></thead>
              <tbody>
                {s.team.map((t) => (
                  <tr key={t.id}><td>{t.name}</td><td>{t.today}</td><td>{t.bookings}</td><td>{t.revenue}</td></tr>
                ))}
              </tbody>
            </table>
            <Link href="/owner/team" className="small" style={{ display: "inline-block", marginTop: 10 }}>Manage team →</Link>
          </section>
          <section className="card">
            <h2>Top services this month</h2>
            {s.topServices.length === 0 ? (
              <p className="muted">No bookings yet this month.</p>
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
