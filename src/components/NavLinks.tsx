"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export interface NavItem {
  href: string;
  label: string;
  cta?: boolean;
  hideSm?: boolean;
}

/** Header menu with the current page highlighted. */
export default function NavLinks({ items, loggedIn }: { items: NavItem[]; loggedIn: boolean }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || (href.length > 1 && path.startsWith(`${href}/`) && !["/owner", "/staff", "/account"].includes(href)));
  return (
    <nav className="nav" aria-label="Main">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={[l.cta ? "btn btn-sm" : "", !l.cta && isActive(l.href) ? "active" : "", l.hideSm ? "hide-sm" : ""].filter(Boolean).join(" ") || undefined}
        >
          {l.label}
        </Link>
      ))}
      {loggedIn && <LogoutButton />}
    </nav>
  );
}
