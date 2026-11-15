import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { getSessionUser, SessionUser } from "@/lib/auth";
import { SALON } from "@/lib/config";
import { ROLE_LABEL } from "@/lib/roles";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: `${SALON.name} — Vancouver Salon`, template: `%s · ${SALON.name}` },
  description: SALON.tagline,
};

// Each role gets its own menu.
function navFor(user: SessionUser | null): { href: string; label: string; cta?: boolean }[] {
  if (!user) return [{ href: "/services", label: "Services" }, { href: "/login", label: "Log in" }, { href: "/book", label: "Book now", cta: true }];
  if (user.role === "OWNER")
    return [
      { href: "/owner", label: "Dashboard" },
      { href: "/owner/appointments", label: "Appointments" },
      { href: "/owner/team", label: "Team" },
      { href: "/owner/clients", label: "Clients" },
      { href: "/owner/services", label: "Services" },
      { href: "/settings", label: "Settings" },
      { href: "/book", label: "New booking", cta: true },
    ];
  if (user.role === "STAFF")
    return [
      { href: "/staff", label: "My schedule" },
      { href: "/staff/time-off", label: "Time off" },
      { href: "/settings", label: "Settings" },
      { href: "/book", label: "New booking", cta: true },
    ];
  return [
    { href: "/services", label: "Services" },
    { href: "/account", label: "My appointments" },
    { href: "/book", label: "Book now", cta: true },
  ];
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const links = navFor(user);
  const portal = user && user.role !== "CUSTOMER";
  return (
    <html lang="en-CA" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <header className={`header ${portal ? "header-portal" : ""}`}>
          <div className="container">
            <Link href={user?.role === "OWNER" ? "/owner" : user?.role === "STAFF" ? "/staff" : "/"} className="logo">
              Maple <span>&amp;</span> Mane
              {portal && <span className="role-pill">{ROLE_LABEL[user.role]}</span>}
            </Link>
            <nav className="nav" aria-label="Main">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className={l.cta ? "btn btn-sm" : undefined}>
                  {l.label}
                </Link>
              ))}
              {user && <LogoutButton />}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container spread">
            <div>
              <strong>{SALON.name}</strong> · {SALON.address}
              <br />
              {SALON.phone} · {SALON.email}
            </div>
            <div>
              {user ? `Signed in as ${user.name} (${ROLE_LABEL[user.role]})` : <Link href="/login">Staff &amp; owner login</Link>}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
