import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { requireOwner, route } from "@/lib/api";
import { formatDate, formatMoney, salonNow } from "@/lib/time";

const { users, appointments } = schema;

interface Row {
  key: string;
  clientId: string | null;
  guestPhone: string | null;
  name: string;
  email: string | null;
  phone: string;
  registered: boolean;
  visits: number;
  upcoming: number;
  noShows: number;
  cancellations: number;
  spentCents: number;
  lastVisit: string | null;
}

type Appt = { date: string; status: string; subtotalCents: number; travelFeeCents: number };

function tally(row: Row, a: Appt, today: string) {
  if (a.status === "COMPLETED") {
    row.visits++;
    row.spentCents += a.subtotalCents + a.travelFeeCents;
    if (!row.lastVisit || a.date > row.lastVisit) row.lastVisit = a.date;
  } else if ((a.status === "BOOKED" || a.status === "CONFIRMED") && a.date >= today) row.upcoming++;
  else if (a.status === "NO_SHOW") row.noShows++;
  else if (a.status === "CANCELLED") row.cancellations++;
}

const emptyRow = (r: Pick<Row, "key" | "clientId" | "guestPhone" | "name" | "email" | "phone" | "registered">): Row => ({
  ...r,
  visits: 0,
  upcoming: 0,
  noShows: 0,
  cancellations: 0,
  spentCents: 0,
  lastVisit: null,
});

// Owner only: client list (registered accounts + walk-in clients grouped by phone number).
export const GET = route(async (req) => {
  await requireOwner();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const today = salonNow().date;
  const db = getDb();
  const sel = { userId: appointments.userId, date: appointments.date, status: appointments.status, subtotalCents: appointments.subtotalCents, travelFeeCents: appointments.travelFeeCents };

  const [customers, owned, guests] = await Promise.all([
    db.select().from(users).where(and(eq(users.role, "CUSTOMER"), eq(users.active, true))).limit(2000),
    db.select(sel).from(appointments).limit(20000),
    db
      .select({ ...sel, guestName: appointments.guestName, guestPhone: appointments.guestPhone, guestEmail: appointments.guestEmail })
      .from(appointments)
      .where(isNull(appointments.userId))
      .limit(5000),
  ]);

  const byUser = new Map<string, Row>();
  for (const c of customers) {
    byUser.set(c.id, emptyRow({ key: c.id, clientId: c.id, guestPhone: null, name: c.name, email: c.email, phone: c.phone, registered: true }));
  }
  for (const a of owned) if (a.userId && byUser.has(a.userId)) tally(byUser.get(a.userId)!, a, today);

  const byPhone = new Map<string, Row>();
  for (const g of guests) {
    const phone = g.guestPhone ?? "unknown";
    if (!byPhone.has(phone)) {
      byPhone.set(phone, emptyRow({ key: `guest:${phone}`, clientId: null, guestPhone: phone, name: g.guestName ?? "Walk-in", email: g.guestEmail, phone, registered: false }));
    }
    tally(byPhone.get(phone)!, g, today);
  }

  const rows = [...byUser.values(), ...byPhone.values()];
  const filtered = rows
    .filter((r) => !q || [r.name, r.email ?? "", r.phone].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "") || a.name.localeCompare(b.name))
    .slice(0, 300);

  return NextResponse.json({
    clients: filtered.map((r) => ({ ...r, spentLabel: formatMoney(r.spentCents), lastVisitLabel: r.lastVisit ? formatDate(r.lastVisit) : "—" })),
    total: rows.length,
  });
});
