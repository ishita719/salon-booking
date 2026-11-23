import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { CategoryIcon, HeroArt } from "@/components/Icons";
import Stars from "@/components/Stars";
import { getDb, schema } from "@/db";
import { BOOKING_RULES, HOME_VISITS, HOURS, SALON } from "@/lib/config";
import GalleryGrid from "@/components/GalleryGrid";
import { galleryItems } from "@/lib/content";
import { publicReviews } from "@/lib/feedback";
import { liveOffers } from "@/lib/offers";
import { formatMoney, formatTime, salonNow, weekdayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default async function Home() {
  const db = getDb();
  const [services, team, reviews, ratings, gallery, offerCount] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.active, true)).orderBy(asc(schema.services.priceCents)),
    db.select().from(schema.stylists).where(eq(schema.stylists.active, true)).orderBy(asc(schema.stylists.name)),
    publicReviews(db, 6),
    db.select({ rating: schema.feedback.rating }).from(schema.feedback),
    galleryItems(db, 6),
    liveOffers(db).then((o) => o.length),
  ]);

  const categories = [...new Set(services.map((s) => s.category))].map((cat) => {
    const list = services.filter((s) => s.category === cat);
    return { cat, count: list.length, from: Math.min(...list.map((s) => s.priceCents)), names: list.slice(0, 3).map((s) => s.name) };
  });
  const avg = ratings.length ? ratings.reduce((t, r) => t + r.rating, 0) / ratings.length : null;
  const todayIdx = weekdayOf(salonNow().date);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Vancouver · In-studio &amp; at-home</div>
            <h1>
              Beauty that fits <span>your life</span>, not the other way around.
            </h1>
            <p className="lead">{SALON.tagline} Book in under a minute, and change your plans any time from your account.</p>
            <div className="hero-cta">
              <Link href="/book" className="btn btn-lg">Book an appointment</Link>
              <Link href="/services" className="btn btn-outline btn-lg">Explore services</Link>
            </div>
            <div className="hero-trust">
              <div><strong>{avg ? avg.toFixed(1) : "5.0"}★</strong>{ratings.length ? `${ratings.length} client review${ratings.length > 1 ? "s" : ""}` : "Loved by locals"}</div>
              <div><strong>{team.length}</strong>expert stylists</div>
              <div><strong>{services.length}</strong>services</div>
            </div>
          </div>
          <div className="hero-art">
            <div className="ring" />
            <div className="orb"><HeroArt /></div>
            <div className="float-card fc-1"><span className="ic">✂</span><div><strong>Online booking</strong><span className="muted">24/7, real-time slots</span></div></div>
            <div className="float-card fc-2"><span className="ic">⌂</span><div><strong>We come to you</strong><span className="muted">+{formatMoney(HOME_VISITS.travelFeeCents)} travel</span></div></div>
            <div className="float-card fc-3"><span className="ic" style={{ color: "var(--gold)" }}>★</span><div><strong>{avg ? avg.toFixed(1) : "5.0"} rating</strong><span className="muted">from happy clients</span></div></div>
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="section">
        <div className="container">
          <div className="spread" style={{ alignItems: "flex-end", marginBottom: 28 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div className="eyebrow">Our menu</div>
              <h2>Everything you need, under one roof</h2>
            </div>
            <Link href="/services" className="btn btn-ghost">View full price list →</Link>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {categories.map((c) => (
              <Link key={c.cat} href={`/services#${encodeURIComponent(c.cat)}`} className="cat-card">
                <span className="cat-icon"><CategoryIcon category={c.cat} /></span>
                <h3 style={{ margin: 0 }}>{c.cat}</h3>
                <span className="small muted">{c.names.join(" · ")}</span>
                <span className="from">From <strong style={{ color: "var(--text)" }}>{formatMoney(c.from)}</strong> · {c.count} service{c.count > 1 ? "s" : ""}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="section" style={{ background: "var(--bg-tint)" }}>
        <div className="container">
          <div className="section-head center center">
            <div className="eyebrow">How it works</div>
            <h2>Booked in three easy steps</h2>
          </div>
          <div className="steps">
            <div className="step"><h3>Choose your services</h3><p className="muted">Pick from our menu or type in exactly what you need — we&apos;ll quote it at your visit.</p></div>
            <div className="step"><h3>Pick a time &amp; place</h3><p className="muted">See live availability for every stylist. Come to the studio or have us come to you.</p></div>
            <div className="step"><h3>Relax — we&apos;ve got it</h3><p className="muted">Get a confirmation email, add it to your calendar, and reschedule up to {BOOKING_RULES.changeCutoffHours} h before.</p></div>
          </div>
        </div>
      </section>

      {/* ---------- Online skin check ---------- */}
      <section className="section">
        <div className="container feature-band">
          <div>
            <div className="eyebrow">New · Free for members</div>
            <h2>Not sure what your skin needs? Check it online first.</h2>
            <p className="lead">Answer 9 quick questions about your skin and hair. We&apos;ll show your skin profile, the treatments that suit you, the products to use at home — and the offers that apply.</p>
            <ul style={{ paddingLeft: 18, color: "var(--muted)" }}>
              <li>Personal morning &amp; evening routine</li>
              <li>Treatments matched to your skin type and concerns</li>
              <li>Product picks with how to use them</li>
              <li>Member prices on recommended services</li>
            </ul>
            <div className="row" style={{ marginTop: 16 }}>
              <Link href="/account/skin-check" className="btn btn-lg">Start my skin check</Link>
              <Link href="/welcome" className="btn btn-outline btn-lg">Join with name &amp; phone</Link>
            </div>
          </div>
          <div className="mock-quiz" aria-hidden>
            <div className="small muted">Question 1 of 9</div>
            <div className="progress"><span style={{ width: "11%" }} /></div>
            <h3>By midday, how does your skin feel?</h3>
            <div className="opt-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="opt"><strong>Shiny all over</strong><span>I often blot</span></div>
              <div className="opt on"><strong>Shiny T-zone</strong><span>Cheeks normal</span></div>
              <div className="opt"><strong>Tight or flaky</strong><span>Needs moisture</span></div>
              <div className="opt"><strong>Comfortable</strong><span>Balanced</span></div>
            </div>
            <div className="alert alert-gold small" style={{ marginTop: 14, marginBottom: 0 }}>✦ Result: Combination skin · Hydra-Glow Facial recommended</div>
          </div>
        </div>
      </section>

      {/* ---------- At-home band ---------- */}
      <section className="section">
        <div className="container">
          <div className="band">
            <div className="band-grid">
              <div>
                <div className="eyebrow" style={{ color: "#f3d9a8" }}>Salon at your door</div>
                <h2 style={{ color: "#fff" }}>Too busy to come in? We&apos;ll come to you.</h2>
                <p className="lead">Cuts, styling, nails, facials and event makeup — in your home, office or hotel anywhere in {HOME_VISITS.areaLabel}.</p>
                <Link href="/book" className="btn btn-light btn-lg" style={{ marginTop: 10 }}>Book a home visit</Link>
              </div>
              <ul>
                <li>✓ Flat {formatMoney(HOME_VISITS.travelFeeCents)} travel fee</li>
                <li>✓ Professional, sanitised kit</li>
                <li>✓ Same stylists as in the studio</li>
                <li>✓ Perfect for weddings &amp; events</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Team ---------- */}
      <section className="section" id="team">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">Meet the team</div>
            <h2>Talented hands, warm hearts</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {team.map((s) => (
              <div key={s.id} className="card team-card card-hover">
                <div className="avatar">{initials(s.name)}</div>
                <h3 style={{ marginBottom: 2 }}>{s.name}</h3>
                <div className="badge badge-gold" style={{ marginBottom: 10 }}>{s.title}</div>
                <p className="muted small" style={{ margin: 0 }}>{s.bio || "Here to make you look and feel your best."}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Our work ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="spread" style={{ alignItems: "flex-end", marginBottom: 24 }}>
            <div className="section-head" style={{ marginBottom: 0 }}>
              <div className="eyebrow">Our work</div>
              <h2>Results we&apos;re proud of</h2>
            </div>
            <Link href="/gallery" className="btn btn-ghost">See the gallery →</Link>
          </div>
          <GalleryGrid items={gallery} />
        </div>
      </section>

      {/* ---------- Member offers teaser ---------- */}
      {offerCount > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="offer-card alt spread" style={{ padding: "32px 36px" }}>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div className="eyebrow" style={{ color: "#f3d9a8" }}>Members only</div>
                <div className="big">{offerCount} offer{offerCount > 1 ? "s" : ""} waiting for you</div>
                <p style={{ margin: "8px 0 0" }}>Log in to see your personal prices — including a welcome discount on your first visit.</p>
              </div>
              <div className="row" style={{ position: "relative", zIndex: 1 }}>
                <Link href="/login?next=/account/offers" className="btn btn-gold btn-lg">See my offers</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Reviews ---------- */}
      <section className="section" id="reviews" style={{ background: "var(--bg-tint)" }}>
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">Kind words</div>
            <h2>What our clients say</h2>
            {avg && <p className="muted"><Stars rating={avg} size="1.2rem" /> &nbsp;{avg.toFixed(1)} average from {ratings.length} review{ratings.length > 1 ? "s" : ""}</p>}
          </div>
          {reviews.length === 0 ? (
            <div className="card center" style={{ maxWidth: 560, margin: "0 auto" }}>
              <p className="muted" style={{ marginBottom: 14 }}>Be one of our first reviewers — after your visit, leave feedback from your account.</p>
              <Link href="/book" className="btn">Book your first visit</Link>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {reviews.map((r) => (
                <figure key={r.id} className="card quote" style={{ margin: 0 }}>
                  <Stars rating={r.rating} />
                  <p style={{ marginTop: 10 }}>{r.comment}</p>
                  <figcaption className="small muted">— {r.name}{r.stylistName ? `, with ${r.stylistName}` : ""}</figcaption>
                  {r.ownerReply && <p className="small" style={{ marginTop: 12, marginBottom: 0, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 10 }}><strong>Salon reply:</strong> {r.ownerReply}</p>}
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Visit ---------- */}
      <section className="section">
        <div className="container dash-cols" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <div className="eyebrow">Opening hours</div>
            <table className="hours-table">
              <tbody>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <tr key={d} className={d === todayIdx ? "today" : undefined}>
                    <td>{DAYS[d]}{d === todayIdx ? " (today)" : ""}</td>
                    <td>{HOURS[d] ? `${formatTime(HOURS[d]!.open)} – ${formatTime(HOURS[d]!.close)}` : "Closed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className="eyebrow">Find us</div>
              <h3>{SALON.name}</h3>
              <p className="muted">{SALON.address}</p>
              <p><a href={`tel:${SALON.phone}`}>{SALON.phone}</a><br /><a href={`mailto:${SALON.email}`}>{SALON.email}</a></p>
            </div>
            <div className="row">
              <Link href="/book" className="btn">Book now</Link>
              <Link href="/welcome" className="btn btn-outline">Join in 30 seconds</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
