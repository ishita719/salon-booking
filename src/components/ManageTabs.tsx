"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/owner/services", label: "Services" },
  { href: "/owner/offers", label: "Offers" },
  { href: "/owner/products", label: "Products" },
  { href: "/owner/gallery", label: "Gallery" },
  { href: "/owner/feedback", label: "Feedback" },
  { href: "/owner/qr", label: "QR codes" },
];

/** Owner "Manage" section tabs. */
export default function ManageTabs() {
  const path = usePathname();
  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <nav className="subnav" aria-label="Manage">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href ? "active" : undefined}>{t.label}</Link>
        ))}
      </nav>
    </div>
  );
}
