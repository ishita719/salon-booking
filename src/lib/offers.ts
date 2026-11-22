// Offers: which ones are live, which services they apply to, and the best discount for a booking.

import { and, eq, inArray, ne } from "drizzle-orm";
import { DB, schema } from "@/db";
import { bestOffer, discountFor, offerAppliesTo, offerIsLive, offerLabel } from "./offer-math";
import { formatMoney, salonNow } from "./time";

export type Offer = typeof schema.offers.$inferSelect;
type SvcLike = { id: string; category: string; priceCents: number };

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export { bestOffer, discountFor, offerAppliesTo, offerIsLive, offerLabel };

export async function liveOffers(db: DB): Promise<Offer[]> {
  const today = salonNow().date;
  return (await db.select().from(schema.offers).where(eq(schema.offers.active, true))).filter((o) => offerIsLive(o, today));
}

/** A client counts as "first visit" until they have a non-cancelled booking. */
export async function isFirstVisit(db: DB, userId: string | null, excludeAppointmentId?: string): Promise<boolean> {
  if (!userId) return false;
  const conds = [eq(schema.appointments.userId, userId), inArray(schema.appointments.status, ["BOOKED", "CONFIRMED", "COMPLETED", "NO_SHOW"])];
  if (excludeAppointmentId) conds.push(ne(schema.appointments.id, excludeAppointmentId));
  const prior = await db.select({ id: schema.appointments.id }).from(schema.appointments).where(and(...conds)).limit(1);
  return prior.length === 0;
}

/** Best price for one service, for showing "was $X, now $Y" badges. */
export function priceWithOffer(offers: Offer[], s: SvcLike, firstVisit: boolean) {
  const b = bestOffer(offers, [s], firstVisit);
  return b ? { priceCents: s.priceCents - b.discountCents, offerTitle: b.offer.title, label: offerLabel(b.offer) } : null;
}

export function serializeOffer(o: Offer, services: { id: string; name: string; category: string }[]) {
  const applies = services.filter((s) => offerAppliesTo(o, s));
  return {
    id: o.id,
    title: o.title,
    description: o.description,
    label: offerLabel(o),
    discountType: o.discountType,
    value: o.value,
    serviceIds: list(o.serviceIds),
    categories: list(o.categories),
    firstVisitOnly: o.firstVisitOnly,
    startsOn: o.startsOn,
    endsOn: o.endsOn,
    active: o.active,
    live: offerIsLive(o),
    appliesToAll: !list(o.serviceIds).length && !list(o.categories).length,
    appliesTo: applies.map((s) => ({ id: s.id, name: s.name })),
  };
}
