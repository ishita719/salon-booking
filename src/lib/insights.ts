// Owner analytics: visitors, bookings, services & charges, payments, offers, skin checks, busiest times.

import { and, count, countDistinct, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { amountDue } from "./bookings";
import { TARGETS, Target } from "./skin";
import { addDays, formatMoney, formatTime, salonNow, weekdayOf } from "./time";

const { pageViews, appointments, appointmentItems, users, skinProfiles } = schema;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function getInsights(days: number) {
  const db = getDb();
  const today = salonNow().date;
  const from = addDays(today, -(days - 1));
  const fromDate = new Date(`${from}T00:00:00Z`);

  const [daily, totals, topPages, appts, signups, skins] = await Promise.all([
    db.select({ date: pageViews.date, visitors: countDistinct(pageViews.visitor), views: count() }).from(pageViews).where(gte(pageViews.date, from)).groupBy(pageViews.date),
    db.select({ visitors: countDistinct(pageViews.visitor), views: count() }).from(pageViews).where(gte(pageViews.date, from)),
    db.select({ path: pageViews.path, views: count() }).from(pageViews).where(gte(pageViews.date, from)).groupBy(pageViews.path).orderBy(desc(count())).limit(8),
    db.select().from(appointments).where(and(gte(appointments.date, from), lte(appointments.date, addDays(today, 365)))),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "CUSTOMER"), gte(users.createdAt, fromDate))),
    db.select({ skinType: skinProfiles.skinType, concerns: skinProfiles.concerns }).from(skinProfiles).where(gte(skinProfiles.updatedAt, fromDate)),
  ]);

  // Bookings MADE in the period (by created date) vs visits HAPPENING in the period (by appointment date).
  const made = appts.filter((a) => a.createdAt >= fromDate);
  const inPeriod = appts.filter((a) => a.date >= from && a.date <= today);
  const live = inPeriod.filter((a) => a.status !== "CANCELLED");
  const completed = inPeriod.filter((a) => a.status === "COMPLETED");

  // Services booked (bookings MADE in the period, not cancelled), with charges.
  const liveMade = made.filter((a) => a.status !== "CANCELLED");
  const ids = liveMade.map((a) => a.id);
  const items: (typeof appointmentItems.$inferSelect)[] = [];
  for (let i = 0; i < ids.length; i += 90) items.push(...(await db.select().from(appointmentItems).where(inArray(appointmentItems.appointmentId, ids.slice(i, i + 90)))));
  const bySvc = new Map<string, { name: string; bookings: number; chargesCents: number; completedCents: number }>();
  const completedIds = new Set(liveMade.filter((a) => a.status === "COMPLETED").map((a) => a.id));
  for (const it of items) {
    const r = bySvc.get(it.name) ?? { name: it.name, bookings: 0, chargesCents: 0, completedCents: 0 };
    r.bookings++;
    r.chargesCents += it.priceCents ?? 0;
    if (completedIds.has(it.appointmentId)) r.completedCents += it.priceCents ?? 0;
    bySvc.set(it.name, r);
  }
  const services = [...bySvc.values()].sort((a, b) => b.chargesCents - a.chargesCents);

  // Payments.
  // Payments count by when the money came in (paid_at), whatever the appointment date.
  const paidIn = (status: string) => appts.filter((a) => a.paymentStatus === status && a.paidAt && a.paidAt >= fromDate).reduce((t, a) => t + a.paidCents, 0);
  const paidOnline = paidIn("PAID_ONLINE");
  const paidSalon = paidIn("PAID_IN_SALON");
  const refunded = paidIn("REFUNDED");
  const outstanding = completed.filter((a) => a.paymentStatus === "UNPAID" || a.paymentStatus === "PENDING").reduce((t, a) => t + amountDue(a), 0);

  // Offers.
  const byOffer = new Map<string, { title: string; uses: number; discountCents: number }>();
  for (const a of liveMade.filter((x) => x.offerTitle)) {
    const r = byOffer.get(a.offerTitle!) ?? { title: a.offerTitle!, uses: 0, discountCents: 0 };
    r.uses++;
    r.discountCents += a.discountCents;
    byOffer.set(a.offerTitle!, r);
  }

  // Busiest days and hours.
  const byDay = DAYS.map((d, i) => ({ label: d, n: live.filter((a) => weekdayOf(a.date) === i).length }));
  const hourMap = new Map<number, number>();
  for (const a of live) hourMap.set(Math.floor(a.startMin / 60), (hourMap.get(Math.floor(a.startMin / 60)) ?? 0) + 1);
  const byHour = [...hourMap.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => ({ label: formatTime(h * 60).replace(":00", ""), n }));

  // Repeat clients (all time).
  const repeatRows = await db
    .select({ userId: appointments.userId, n: count() })
    .from(appointments)
    .where(and(eq(appointments.status, "COMPLETED"), sql`${appointments.userId} IS NOT NULL`))
    .groupBy(appointments.userId);
  const clientsWithVisit = repeatRows.length;
  const repeatClients = repeatRows.filter((r) => r.n >= 2).length;

  // Skin checks.
  const skinTypes = new Map<string, number>();
  const concerns = new Map<string, number>();
  for (const s of skins) {
    skinTypes.set(s.skinType, (skinTypes.get(s.skinType) ?? 0) + 1);
    for (const c of s.concerns.split(",").filter(Boolean)) concerns.set(c, (concerns.get(c) ?? 0) + 1);
  }

  // Daily series with zero-filled days.
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    const row = daily.find((r) => r.date === d);
    return { date: d, visitors: row?.visitors ?? 0, views: row?.views ?? 0, bookings: made.filter((a) => a.createdAt.toISOString().slice(0, 10) === d).length };
  });

  const visitors = totals[0]?.visitors ?? 0;
  const onlineBookings = made.filter((a) => a.source === "ONLINE").length;
  const value = (a: { subtotalCents: number; travelFeeCents: number; discountCents: number }) => amountDue(a);

  return {
    days,
    from,
    to: today,
    visitors,
    pageViews: totals[0]?.views ?? 0,
    bookingsMade: made.length,
    onlineBookings,
    salonBookings: made.length - onlineBookings,
    conversion: visitors ? `${Math.min(100, (onlineBookings / visitors) * 100).toFixed(1)}%` : "—",
    newClients: signups[0]?.n ?? 0,
    visitsInPeriod: live.length,
    completedVisits: completed.length,
    cancelled: inPeriod.filter((a) => a.status === "CANCELLED").length,
    noShows: inPeriod.filter((a) => a.status === "NO_SHOW").length,
    revenue: formatMoney(completed.reduce((t, a) => t + value(a), 0)),
    bookedValue: formatMoney(live.reduce((t, a) => t + value(a), 0)),
    avgTicket: completed.length ? formatMoney(Math.round(completed.reduce((t, a) => t + value(a), 0) / completed.length)) : "—",
    discounts: formatMoney(liveMade.reduce((t, a) => t + a.discountCents, 0)),
    payments: { online: formatMoney(paidOnline), salon: formatMoney(paidSalon), refunded: formatMoney(refunded), outstanding: formatMoney(outstanding) },
    homeVisits: live.filter((a) => a.locationType === "HOME").length,
    services: services.map((s) => ({ ...s, charges: formatMoney(s.chargesCents), completed: formatMoney(s.completedCents), avg: formatMoney(Math.round(s.chargesCents / s.bookings)) })),
    offers: [...byOffer.values()].map((o) => ({ ...o, discount: formatMoney(o.discountCents) })),
    topPages: topPages,
    series,
    byDay,
    byHour,
    repeatRate: clientsWithVisit ? `${Math.round((repeatClients / clientsWithVisit) * 100)}%` : "—",
    repeatClients,
    skinChecks: skins.length,
    skinTypes: [...skinTypes.entries()].map(([k, n]) => ({ label: TARGETS[k as Target] ?? k, n })).sort((a, b) => b.n - a.n),
    topConcerns: [...concerns.entries()].map(([k, n]) => ({ label: TARGETS[k as Target] ?? k, n })).sort((a, b) => b.n - a.n).slice(0, 6),
  };
}

export type Insights = Awaited<ReturnType<typeof getInsights>>;
