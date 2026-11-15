import Link from "next/link";
import { BOOKING_RULES, HOME_VISITS, HOURS, SALON } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDuration, formatMoney, formatTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Home() {
  const [featured, stylists] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { priceCents: "asc" }, take: 6 }),
    prisma.stylist.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Vancouver, BC · In-studio & at-home</div>
          <h1>Look good. Feel at home.</h1>
          <p className="lead">{SALON.tagline} Book online in under a minute and change it any time from your account.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/book" className="btn btn-lg">Book an appointment</Link>
            <Link href="/services" className="btn btn-outline btn-lg">View services</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="grid">
            <div className="card">
              <h3>Book in seconds</h3>
              <p className="muted">Pick services from our menu — or type in what you need — choose a stylist and a time that suits you.</p>
            </div>
            <div className="card">
              <h3>We come to you</h3>
              <p className="muted">
                At-home visits across {HOME_VISITS.areaLabel}. Flat {formatMoney(HOME_VISITS.travelFeeCents)} travel fee.
              </p>
            </div>
            <div className="card">
              <h3>Plans change? No problem</h3>
              <p className="muted">Reschedule or cancel online up to {BOOKING_RULES.changeCutoffHours} hours before your visit. Add it to your calendar in one click.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="spread">
            <h2>Popular services</h2>
            <Link href="/services">See full menu →</Link>
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            {featured.map((s) => (
              <div key={s.id} className="card-flat">
                <div className="spread">
                  <strong>{s.name}</strong>
                  <strong>{formatMoney(s.priceCents)}</strong>
                </div>
                <div className="muted small">
                  {formatDuration(s.durationMin)} · {s.homeAvailable ? "Salon or at home" : "Salon only"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <div className="card">
            <h2>Our team</h2>
            <div className="stack">
              {stylists.map((s) => (
                <div key={s.id}>
                  <strong>{s.name}</strong> <span className="muted">— {s.title}</span>
                  <div className="small muted">{s.bio}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Hours</h2>
            <table>
              <tbody>
                {[2, 3, 4, 5, 6, 0, 1].map((d) => (
                  <tr key={d}>
                    <td>{DAYS[d]}</td>
                    <td>{HOURS[d] ? `${formatTime(HOURS[d]!.open)} – ${formatTime(HOURS[d]!.close)}` : "Closed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ marginTop: 12 }}>{SALON.address} · {SALON.phone}</p>
          </div>
        </div>
      </section>
    </>
  );
}
