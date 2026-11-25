"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

export interface NavItem {
  href: string;
  label: string;
  cta?: boolean;
  hideSm?: boolean;
}

/** Header menu with the current page highlighted. On phones it folds into a "Menu" button. */
export default function NavLinks({ items, loggedIn }: { items: NavItem[]; loggedIn: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]); // close after navigating
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || (href.length > 1 && path.startsWith(`${href}/`) && !["/owner", "/staff", "/account"].includes(href)));
  const cta = items.find((l) => l.cta);
  return (
    <>
      <div className="nav-wrap">
        {cta && <Link href={cta.href} className="btn btn-sm nav-book">{cta.label}</Link>}
        <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="main-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span className="nav-toggle-label">{open ? "Close" : "Menu"}</span>
        </button>
      </div>
      <nav id="main-nav" className={`nav ${open ? "open" : ""}`} aria-label="Main">
        {items.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={[l.cta ? "btn btn-sm" : "", !l.cta && isActive(l.href) ? "active" : ""].filter(Boolean).join(" ") || undefined}
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        {loggedIn && <LogoutButton />}
      </nav>
    </>
  );
}
