"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Counts an anonymous page view for the owner's visitor stats (no personal data). */
export default function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    if (/^\/(owner|staff|team)(\/|$)/.test(path)) return;
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }), keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
