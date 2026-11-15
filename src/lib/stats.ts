// Business numbers for the owner dashboard.

import { appointmentInclude, serialize } from "./bookings";
import { prisma } from "./db";
import { addDays, formatMoney, salonNow } from "./time";

export async function getOwnerStats() {
  const today = salonNow().date;
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = today; // next 7 days, today included
  const weekEnd = addDays(today, 6);

  const [monthAppts, todayAppts, upcomingCount, newClients, stylists] = await Promise.all([
    prisma.appointment.findMany({
      where: { date: { gte: monthStart, lte: `${today.slice(0, 7)}-31` } },
      select: { status: true, subtotalCents: true, travelFeeCents: true, stylistId: true, source: true, locationType: true, items: { select: { name: true } } },
    }),
    prisma.appointment.findMany({ where: { date: today }, include: appointmentInclude, orderBy: { startMin: "asc" } }),
    prisma.appointment.count({ where: { date: { gte: today }, status: { in: ["BOOKED", "CONFIRMED"] } } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: new Date(`${monthStart}T00:00:00Z`) } } }),
    prisma.stylist.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const weekCount = await prisma.appointment.count({
    where: { date: { gte: weekStart, lte: weekEnd }, status: { in: ["BOOKED", "CONFIRMED", "COMPLETED"] } },
  });

  const value = (a: { subtotalCents: number; travelFeeCents: number }) => a.subtotalCents + a.travelFeeCents;
  const completed = monthAppts.filter((a) => a.status === "COMPLETED");
  const booked = monthAppts.filter((a) => a.status === "BOOKED" || a.status === "CONFIRMED");
  const cancelled = monthAppts.filter((a) => a.status === "CANCELLED").length;
  const noShows = monthAppts.filter((a) => a.status === "NO_SHOW").length;
  const decided = completed.length + noShows;

  const serviceCounts = new Map<string, number>();
  for (const a of monthAppts) if (a.status !== "CANCELLED") for (const i of a.items) serviceCounts.set(i.name, (serviceCounts.get(i.name) ?? 0) + 1);

  return {
    today,
    revenueMonth: formatMoney(completed.reduce((t, a) => t + value(a), 0)),
    expectedMonth: formatMoney(booked.reduce((t, a) => t + value(a), 0)),
    todayCount: todayAppts.filter((a) => a.status !== "CANCELLED").length,
    weekCount,
    upcomingCount,
    newClients,
    cancelled,
    noShowRate: decided ? `${Math.round((noShows / decided) * 100)}%` : "0%",
    onlineShare: monthAppts.length ? `${Math.round((monthAppts.filter((a) => a.source === "ONLINE").length / monthAppts.length) * 100)}%` : "—",
    homeVisits: monthAppts.filter((a) => a.locationType === "HOME" && a.status !== "CANCELLED").length,
    topServices: [...serviceCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    team: stylists.map((s) => {
      const mine = monthAppts.filter((a) => a.stylistId === s.id);
      return {
        id: s.id,
        name: s.name,
        bookings: mine.filter((a) => a.status !== "CANCELLED").length,
        revenue: formatMoney(mine.filter((a) => a.status === "COMPLETED").reduce((t, a) => t + value(a), 0)),
        today: todayAppts.filter((a) => a.stylistId === s.id && a.status !== "CANCELLED").length,
      };
    }),
    todaySchedule: todayAppts.map(serialize),
  };
}
