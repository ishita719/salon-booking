import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import NavLinks, { NavItem } from "@/components/NavLinks";
import VisitTracker from "@/components/VisitTracker";
import { getSessionUser, SessionUser } from "@/lib/auth";
import { HOME_VISITS, SALON } from "@/lib/config";
import { ROLE_LABEL } from "@/lib/roles";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: `${SALON.name} — Hair, Skin & Nails in Vancouver`, template: `%s · ${SALON.name}` },
  description: SALON.tagline,
};

// Each role gets its own menu.
function navFor(user: SessionUser | null): NavItem[] {
  if (!user)
    return [
      { href: "/services", label: "Services", hideSm: true },
      { href: "/gallery", label: "Our work", hideSm: true },
      { href: "/#reviews", label: "Reviews", hideSm: true },
      { href: "/account/skin-check", label: "Skin check", hideSm: true },
      { href: "/login", label: "Client login" },
      { href: "/book", label: "Book now", cta: true },
    ];
  if (user.role === "OWNER")
    return [
      { href: "/owner", label: "Dashboard" },
      { href: "/owner/insights", label: "Insights" },
      { href: "/owner/appointments", label: "Appointments" },
      { href: "/owner/clients", label: "Clients" },
      { href: "/owner/team", label: "Team" },
      { href: "/owner/services", label: "Manage" },
      { href: "/settings", label: "Settings" },
      { href: "/book", label: "New booking", cta: true },
    ];
  if (user.role === "STAFF")
    return [
      { href: "/staff", label: "My schedule" },
      { href: "/staff/time-off", label: "Time off" },
      { href: "/staff/reviews", label: "My reviews" },
      { href: "/settings", label: "Settings" },
      { href: "/book", label: "Book a client", cta: true },
    ];
  return [
    { href: "/account", label: "For you" },
    { href: "/account/skin-check", label: "Skin check" },
    { href: "/account/appointments", label: "Appointments" },
    { href: "/account/offers", label: "Offers" },
    { href: "/account/products", label: "Products", hideSm: true },
    { href: "/account/feedback", label: "Feedback", hideSm: true },
    { href: "/book", label: "Book now", cta: true },
  ];
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser().catch(() => null);
  const portal = user && user.role !== "CUSTOMER";
  return (
    <html lang="en-CA" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <VisitTracker />
        <header className="header">
          <div className="container">
            <div className="row" style={{ gap: 10 }}>
              <Link href={user?.role === "OWNER" ? "/owner" : user?.role === "STAFF" ? "/staff" : "/"} className="logo">
                <span className="logo-mark" aria-hidden>✦</span>
                Maple <em>&amp;</em> Mane
              </Link>
              {portal && <span className="role-pill">{ROLE_LABEL[user.role]}</span>}
            </div>
            <NavLinks items={navFor(user)} loggedIn={!!user} />
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            <div className="footer-grid">
              <div>
                <Link href="/" className="logo"><span className="logo-mark" aria-hidden>✦</span>Maple <em>&amp;</em> Mane</Link>
                <p style={{ marginTop: 14, maxWidth: 320 }}>{SALON.tagline}</p>
              </div>
              <div>
                <h4>Visit</h4>
                <ul>
                  <li>{SALON.address}</li>
                  <li>At-home visits: {HOME_VISITS.areaLabel}</li>
                </ul>
              </div>
              <div>
                <h4>Contact</h4>
                <ul>
                  <li><a href={`tel:${SALON.phone}`}>{SALON.phone}</a></li>
                  <li><a href={`mailto:${SALON.email}`}>{SALON.email}</a></li>
                </ul>
              </div>
              <div>
                <h4>Clients &amp; team</h4>
                <ul>
                  <li><Link href="/book">Book an appointment</Link></li>
                  <li><Link href="/account/skin-check">Online skin check</Link></li>
                  <li><Link href="/gallery">Our work</Link></li>
                  <li><Link href="/login">Client login</Link></li>
                  <li><Link href="/team">Salon team login</Link></li>
                </ul>
              </div>
            </div>
            <div className="footer-bottom spread">
              <span>© {new Date().getFullYear()} {SALON.name} · Vancouver, BC <span className="photo-credit">· Photos: Unsplash</span></span>
              {user && <span>Signed in as {user.name} ({ROLE_LABEL[user.role]})</span>}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
