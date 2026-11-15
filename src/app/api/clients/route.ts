import { NextResponse } from "next/server";
import { requireOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { formatDate, formatMoney, salonNow } from "@/lib/time";

interface Row {
  key: string;
  clientId: string | null;
  guestPhone: string | null;
  name: string;
  email: string | null;
  phone: string;
  registered: boolean;
  since: string | null;
  visits: number;
  upcoming: number;
  noShows: number;
  cancellations: number;
  spentCents: number;
  lastVisit: string | null;
}

type Appt = { date: string; status: string; subtotalCents: number; travelFeeCents: number };

function tally(row: Row, appts: Appt[], today: string) {
  for (const a of appts) {
    if (a.status === "COMPLETED") {
      row.visits++;
      row.spentCents += a.subtotalCents + a.travelFeeCents;
      if (!row.lastVisit || a.date > row.lastVisit) row.lastVisit = a.date;
    } else if ((a.status === "BOOKED" || a.status === "CONFIRMED") && a.date >= today) row.upcoming++;
    else if (a.status === "NO_SHOW") row.noShows++;
    else if (a.status === "CANCELLED") row.cancellations++;
  }
}

// Owner only: client list (registered accounts + walk-in clients grouped by phone number).
export const GET = route(async (req) => {
  await requireOwner();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const today = salonNow().date;
  const apptSelect = { date: true, status: true, subtotalCents: true, travelFeeCents: true } as const;

  const [customers, guests] = await Promise.all([
    prisma.user.findMany({ where: { role: "CUSTOMER", active: true }, include: { appointments: { select: apptSelect } }, take: 1000 }),
    prisma.appointment.findMany({ where: { userId: null }, select: { ...apptSelect, guestName: true, guestPhone: true, guestEmail: true }, take: 5000 }),
  ]);

  const rows: Row[] = customers.map((c) => {
    const r: Row = {
      key: c.id, clientId: c.id, guestPhone: null, name: c.name, email: c.email, phone: c.phone, registered: true,
      since: c.createdAt.toISOString().slice(0, 10), visits: 0, upcoming: 0, noShows: 0, cancellations: 0, spentCents: 0, lastVisit: null,
    };
    tally(r, c.appointments, today);
    return r;
  });

  const byPhone = new Map<string, Row>();
  for (const g of guests) {
    const phone = g.guestPhone ?? "unknown";
    let r = byPhone.get(phone);
    if (!r) {
      r = { key: `guest:${phone}`, clientId: null, guestPhone: phone, name: g.guestName ?? "Walk-in", email: g.guestEmail, phone, registered: false,
        since: null, visits: 0, upcoming: 0, noShows: 0, cancellations: 0, spentCents: 0, lastVisit: null };
      byPhone.set(phone, r);
    }
    tally(r, [g], today);
  }
  rows.push(...byPhone.values());

  const filtered = rows
    .filter((r) => !q || [r.name, r.email ?? "", r.phone].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "") || a.name.localeCompare(b.name))
    .slice(0, 300);

  return NextResponse.json({
    clients: filtered.map((r) => ({
      ...r,
      spentLabel: formatMoney(r.spentCents),
      lastVisitLabel: r.lastVisit ? formatDate(r.lastVisit) : "—",
    })),
    total: rows.length,
  });
});
