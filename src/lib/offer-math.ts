// Pure offer calculations, shared by the server (booking) and the browser (live price preview).

import { formatMoney, salonNow } from "./time";

export interface OfferLike {
  id: string;
  title: string;
  discountType: string; // PERCENT | AMOUNT
  value: number;
  serviceIds: string; // comma list
  categories: string; // comma list
  firstVisitOnly: boolean;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
}
type SvcLike = { id: string; category: string; priceCents: number };

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export function offerIsLive(o: OfferLike, today = salonNow().date): boolean {
  return o.active && (!o.startsOn || o.startsOn <= today) && (!o.endsOn || o.endsOn >= today);
}

export function offerAppliesTo(o: OfferLike, s: { id: string; category: string }): boolean {
  const ids = list(o.serviceIds);
  const cats = list(o.categories);
  if (!ids.length && !cats.length) return true;
  return ids.includes(s.id) || cats.includes(s.category);
}

export function offerLabel(o: Pick<OfferLike, "discountType" | "value">): string {
  return o.discountType === "AMOUNT" ? `${formatMoney(o.value)} off` : `${o.value}% off`;
}

/** Discount (cents) an offer gives on the eligible part of a set of services. */
export function discountFor(o: OfferLike, services: SvcLike[]): number {
  const eligible = services.filter((s) => offerAppliesTo(o, s)).reduce((t, s) => t + s.priceCents, 0);
  if (!eligible) return 0;
  const d = o.discountType === "AMOUNT" ? o.value : Math.round((eligible * Math.min(o.value, 90)) / 100);
  return Math.min(d, eligible);
}

/** The single best offer for these services (offers don't stack). */
export function bestOffer<T extends OfferLike>(offers: T[], services: SvcLike[], isFirstVisit: boolean) {
  let best: { offer: T; discountCents: number } | null = null;
  for (const o of offers) {
    if (o.firstVisitOnly && !isFirstVisit) continue;
    const d = discountFor(o, services);
    if (d > 0 && (!best || d > best.discountCents)) best = { offer: o, discountCents: d };
  }
  return best;
}
