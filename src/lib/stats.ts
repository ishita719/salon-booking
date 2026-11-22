// Business numbers for the owner dashboard.

import { and, asc, count, countDistinct, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hydrate, serialize } from "./bookings";
import { addDays, formatMoney, salonNow } from "./time";

const { appointments, appointmentItems, users, stylists, feedback, pageViews } = schema;

export async function getOwnerStats() {
  const db = getDb();
  const today = salonNow().date;
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  const weekEnd = addDays(today, 6);

  const [monthAppts, todayRows, upcoming, newClients, team, week, ratings, latestFeedback, visitorsToday] = await Promise.all([
    db.select().from(appointments).where(and(gte(appointments.date, monthStart), lte(appointments.date, monthEnd))),
    db.select().from(appointments).where(eq(appointments.date, today)).orderBy(asc(appointments.startMin)),
    db.select({ n: count() }).from(appointments).where(and(gte(appointments.date, today), inArray(appointments.status, ["BOOKED", "CONFIRMED"]))),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "CUSTOMER"), gte(users.createdAt, new Date(`${monthStart}T00:00:00Z`)))),
    db.select({ id: stylists.id, name: stylists.name }).from(stylists).where(eq(stylists.active, true)).orderBy(stylists.name),
    db.select({ n: count() }).from(appointments).where(and(gte(appointments.date, today), lte(appointments.date, weekEnd), inArray(appointments.status, ["BOOKED", "CONFIRMED", "COMPLETED"]))),
    db.select({ rating: feedback.rating }).from(feedback),
    db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(3),
    db.select({ n: countDistinct(pageViews.visitor) }).from(pageViews).where(eq(pageViews.date, today)),
  ]);

  // Top services this month (by line items on non-cancelled bookings).
  const live = monthAppts.filter((a) => a.status !== "CANCELLED");
  const itemRows = [];
  for (let i = 0; i < live.length; i += 90) {
    itemRows.push(...(await db.select({ name: appointmentItems.name }).from(appointmentItems).where(inArray(appointmentItems.appointmentId, live.slice(i, i + 90).map((a) => a.id)))));
  }
  const serviceCounts = new Map<string, number>();
  for (const i of itemRows) serviceCounts.set(i.name, (serviceCounts.get(i.name) ?? 0) + 1);

  const value = (a: { subtotalCents: number; travelFeeCents: number }) => a.subtotalCents + a.travelFeeCents;
  const completed = monthAppts.filter((a) => a.status === "COMPLETED");
  const booked = monthAppts.filter((a) => a.status === "BOOKED" || a.status === "CONFIRMED");
  const cancelled = monthAppts.filter((a) => a.status === "CANCELLED").length;
  const noShows = monthAppts.filter((a) => a.status === "NO_SHOW").length;
  const decided = completed.length + noShows;
  const avg = ratings.length ? ratings.reduce((t, r) => t + r.rating, 0) / ratings.length : null;

  const todaySchedule = (await hydrate(db, todayRows)).map(serialize);
  const reviewers = latestFeedback.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, latestFeedback.map((f) => f.userId)))
    : [];

  return {
    today,
    revenueMonth: formatMoney(completed.reduce((t, a) => t + value(a), 0)),
    expectedMonth: formatMoney(booked.reduce((t, a) => t + value(a), 0)),
    todayCount: todayRows.filter((a) => a.status !== "CANCELLED").length,
    weekCount: week[0]?.n ?? 0,
    upcomingCount: upcoming[0]?.n ?? 0,
    newClients: newClients[0]?.n ?? 0,
    cancelled,
    noShowRate: decided ? `${Math.round((noShows / decided) * 100)}%` : "0%",
    onlineShare: monthAppts.length ? `${Math.round((monthAppts.filter((a) => a.source === "ONLINE").length / monthAppts.length) * 100)}%` : "—",
    homeVisits: live.filter((a) => a.locationType === "HOME").length,
    avgRating: avg == null ? "—" : avg.toFixed(1),
    visitorsToday: visitorsToday[0]?.n ?? 0,
    reviewCount: ratings.length,
    latestFeedback: latestFeedback.map((f) => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      name: reviewers.find((r) => r.id === f.userId)?.name ?? "Client",
    })),
    topServices: [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => ({ name, count: n })),
    team: team.map((s) => {
      const mine = monthAppts.filter((a) => a.stylistId === s.id);
      return {
        id: s.id,
        name: s.name,
        bookings: mine.filter((a) => a.status !== "CANCELLED").length,
        revenue: formatMoney(mine.filter((a) => a.status === "COMPLETED").reduce((t, a) => t + value(a), 0)),
        today: todayRows.filter((a) => a.stylistId === s.id && a.status !== "CANCELLED").length,
      };
    }),
    todaySchedule,
  };
}
