// Small inline SVG icons (no external image files needed).

const base = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function CategoryIcon({ category }: { category: string }) {
  const c = category.toLowerCase();
  if (c.includes("colour") || c.includes("color"))
    return (
      <svg {...base} aria-hidden>
        <path d="M12 3c3.5 4.2 6 7.4 6 10.5A6 6 0 0 1 6 13.5C6 10.4 8.5 7.2 12 3Z" />
        <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5" />
      </svg>
    );
  if (c.includes("nail"))
    return (
      <svg {...base} aria-hidden>
        <path d="M8 21v-9a4 4 0 0 1 8 0v9" />
        <path d="M8 13c1.3-1 2.6-1.5 4-1.5s2.7.5 4 1.5" />
        <path d="M10 3h4l-.5 4h-3z" />
      </svg>
    );
  if (c.includes("skin"))
    return (
      <svg {...base} aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M9 10h.01M15 10h.01" />
        <path d="M9 14.5c1.6 1.4 4.4 1.4 6 0" />
      </svg>
    );
  if (c.includes("treat"))
    return (
      <svg {...base} aria-hidden>
        <path d="M12 21c-4-2.5-7-5.5-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5c0 4-3 7-7 9.5Z" />
        <path d="M12 3v3M8.5 4.5 10 6.5M15.5 4.5 14 6.5" />
      </svg>
    );
  if (c.includes("bridal") || c.includes("event"))
    return (
      <svg {...base} aria-hidden>
        <path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4-3.9-3.8 5.4-.8Z" />
      </svg>
    );
  // Hair (default): scissors
  return (
    <svg {...base} aria-hidden>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
    </svg>
  );
}

/** Decorative hero illustration: flowing hair line art. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M100 30c-30 0-50 22-50 52 0 20 8 32 8 46 0 18-14 26-14 40" opacity=".9" />
      <path d="M100 30c30 0 50 22 50 52 0 20-8 32-8 46 0 18 14 26 14 40" opacity=".9" />
      <path d="M78 52c-12 14-14 34-8 54s4 40-8 58" opacity=".55" />
      <path d="M122 52c12 14 14 34 8 54s-4 40 8 58" opacity=".55" />
      <path d="M100 34c-6 24-6 48 0 72s6 44 0 64" opacity=".35" />
      <circle cx="100" cy="88" r="26" fill="rgba(255,255,255,.12)" />
      <path d="M90 84h.01M110 84h.01" strokeWidth="4" />
      <path d="M92 97c5 4 11 4 16 0" />
      <path d="M60 158c12-6 26-9 40-9s28 3 40 9" opacity=".7" />
    </svg>
  );
}
