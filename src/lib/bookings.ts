// Booking business logic shared by the API routes and pages.

import { and, eq, inArray, ne, SQL } from "drizzle-orm";
import { DB, schema } from "@/db";
import { ApiError } from "./api";
import type { SessionUser } from "./auth";
import { BusyBlock, computeSlots, dateProblem, LocationType } from "./availability";
import { ACTIVE_STATUSES, BOOKING_RULES, HOME_VISITS } from "./config";
import { formatDate, formatMoney, formatTime, minutesUntil, weekdayOf } from "./time";

const { appointments, appointmentItems, stylists, users, services, timeOff } = schema;

type Appointment = typeof appointments.$inferSelect;
export type FullAppointment = Appointment & {
  items: (typeof appointmentItems.$inferSelect)[];
  stylist: { id: string; name: string } | null;
  user: { id: string; name: string; email: string; phone: string } | null;
};

/** D1 allows at most 100 bound parameters per query, so big IN (...) lists are split up. */
async function inChunks<T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 90) out.push(...(await fn(ids.slice(i, i + 90))));
  return out;
}

export function parseWorkDays(s: string): number[] {
  return s
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function worksOn(workDays: string, date: string): boolean {
  return parseWorkDays(workDays).includes(weekdayOf(date));
}

/** Existing active appointments AND staff time off for a day, as blocks that make a stylist busy. */
export async function busyBlocks(db: DB, date: string, excludeId?: string): Promise<BusyBlock[]> {
  const conds: SQL[] = [eq(appointments.date, date), inArray(appointments.status, [...ACTIVE_STATUSES])];
  if (excludeId) conds.push(ne(appointments.id, excludeId));
  const [appts, off] = await Promise.all([
    db
      .select({ stylistId: appointments.stylistId, startMin: appointments.startMin, endMin: appointments.endMin, locationType: appointments.locationType })
      .from(appointments)
      .where(and(...conds)),
    db.select({ stylistId: timeOff.stylistId, startMin: timeOff.startMin, endMin: timeOff.endMin }).from(timeOff).where(eq(timeOff.date, date)),
  ]);
  return [...appts, ...off.map((o) => ({ ...o, locationType: "SALON" }))];
}

/** Active stylists who work on that weekday (optionally only one specific stylist). */
export async function candidateStylists(db: DB, date: string, stylistId?: string | null): Promise<{ ids: string[]; message: string | null }> {
  if (stylistId) {
    const s = await db.query.stylists.findFirst({ where: and(eq(stylists.id, stylistId), eq(stylists.active, true)) });
    if (!s) throw new ApiError(400, "That stylist is not available.");
    if (!worksOn(s.workDays, date)) return { ids: [], message: `${s.name} doesn't work that day — try another day or "Any available stylist".` };
    return { ids: [s.id], message: null };
  }
  const all = await db.select().from(stylists).where(eq(stylists.active, true)).orderBy(stylists.name);
  const ids = all.filter((s) => worksOn(s.workDays, date)).map((s) => s.id);
  return { ids, message: ids.length ? null : "No stylists are working that day." };
}

/** Checks the requested time is free and picks the stylist to assign. */
export async function pickStylistForSlot(
  db: DB,
  o: { date: string; startMin: number; durationMin: number; locationType: LocationType; stylistId?: string | null; excludeId?: string; minNoticeMin?: number },
): Promise<string> {
  const problem = dateProblem(o.date);
  if (problem) throw new ApiError(400, problem);
  const { ids, message } = await candidateStylists(db, o.date, o.stylistId);
  if (!ids.length) throw new ApiError(409, message ?? "No stylist available.");
  const busy = await busyBlocks(db, o.date, o.excludeId);
  const slot = computeSlots({ date: o.date, durationMin: o.durationMin, locationType: o.locationType, stylistIds: ids, busy, minNoticeMin: o.minNoticeMin }).find(
    (s) => s.startMin === o.startMin,
  );
  if (!slot) throw new ApiError(409, "Sorry, that time was just taken or is no longer available. Please pick another.");
  // Spread work evenly: the free stylist with the fewest bookings that day.
  const load = (id: string) => busy.filter((b) => b.stylistId === id).length;
  return [...slot.stylistIds].sort((a, b) => load(a) - load(b))[0];
}

/**
 * Double-booking guard (D1 has no long-running transactions): after saving, look for an overlapping booking
 * for the same stylist. If one exists that was saved first, this booking lost the race.
 */
export async function lostRace(
  db: DB,
  appt: { id: string; stylistId: string | null; date: string; startMin: number; endMin: number; locationType: string; createdAt: Date },
  strict = false, // reschedules: any overlap means the move fails (an existing booking always wins)
) {
  if (!appt.stylistId) return false;
  const buf = (t: string) => (t === "HOME" ? HOME_VISITS.travelBufferMin : 0);
  const others = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.stylistId, appt.stylistId), eq(appointments.date, appt.date), inArray(appointments.status, [...ACTIVE_STATUSES]), ne(appointments.id, appt.id)));
  const offs = await db.select().from(timeOff).where(and(eq(timeOff.stylistId, appt.stylistId), eq(timeOff.date, appt.date)));
  if (offs.some((o) => o.startMin < appt.endMin && appt.startMin < o.endMin)) return true;
  return others.some((o) => {
    const overlap = o.startMin - buf(o.locationType) < appt.endMin + buf(appt.locationType) && appt.startMin - buf(appt.locationType) < o.endMin + buf(o.locationType);
    if (!overlap) return false;
    if (strict) return true;
    const t1 = o.createdAt.getTime();
    const t2 = appt.createdAt.getTime();
    return t1 < t2 || (t1 === t2 && o.id < appt.id); // the earlier booking wins
  });
}

/** Turns selected service ids + typed-in services into priced line items. */
export async function buildItems(db: DB, serviceIds: string[], customServices: string[], locationType: LocationType) {
  const found = serviceIds.length ? await db.select().from(services).where(and(inArray(services.id, serviceIds), eq(services.active, true))) : [];
  if (found.length !== serviceIds.length) throw new ApiError(400, "One of the selected services is no longer offered.");
  if (locationType === "HOME") {
    const notHome = found.find((s) => !s.homeAvailable);
    if (notHome) throw new ApiError(400, `"${notHome.name}" is only available in the salon.`);
  }
  const items = [
    ...found.map((s) => ({ serviceId: s.id as string | null, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents as number | null, isCustom: false })),
    ...customServices.map((name) => ({ serviceId: null, name, durationMin: BOOKING_RULES.customServiceDurationMin, priceCents: null, isCustom: true })),
  ];
  return {
    items,
    durationMin: items.reduce((t, i) => t + i.durationMin, 0),
    subtotalCents: items.reduce((t, i) => t + (i.priceCents ?? 0), 0),
    travelFeeCents: locationType === "HOME" ? HOME_VISITS.travelFeeCents : 0,
    hasCustom: customServices.length > 0,
  };
}

/** Adds items, stylist and client details to appointment rows. */
export async function hydrate(db: DB, rows: Appointment[]): Promise<FullAppointment[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const stylistIds = [...new Set(rows.map((r) => r.stylistId).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
  const [items, sty, usr] = await Promise.all([
    inChunks(ids, (c) => db.select().from(appointmentItems).where(inArray(appointmentItems.appointmentId, c))),
    inChunks(stylistIds, (c) => db.select({ id: stylists.id, name: stylists.name }).from(stylists).where(inArray(stylists.id, c))),
    inChunks(userIds, (c) => db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(inArray(users.id, c))),
  ]);
  return rows.map((r) => ({
    ...r,
    items: items.filter((i) => i.appointmentId === r.id),
    stylist: sty.find((s) => s.id === r.stylistId) ?? null,
    user: usr.find((u) => u.id === r.userId) ?? null,
  }));
}

export async function loadAppointment(db: DB, id: string): Promise<FullAppointment | null> {
  const row = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
  return row ? (await hydrate(db, [row]))[0] : null;
}

/** Who may see/manage an appointment: the owner, the client who booked it, or the stylist assigned to it. */
export function canAccess(user: SessionUser, a: { userId: string | null; stylistId: string | null }): boolean {
  if (user.role === "OWNER") return true;
  if (user.role === "STAFF") return !!user.stylistId && a.stylistId === user.stylistId;
  return a.userId === user.id;
}

export function canClientChange(a: { status: string; date: string; startMin: number }): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(a.status) && minutesUntil(a.date, a.startMin) >= BOOKING_RULES.changeCutoffHours * 60;
}

export const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Pay at salon",
  PENDING: "Awaiting online payment",
  PAID_ONLINE: "Paid online",
  PAID_IN_SALON: "Paid at salon",
  REFUNDED: "Refunded",
};

/** What the client owes for priced items: services + travel − offer discount (custom services are quoted at the visit). */
export function amountDue(a: { subtotalCents: number; travelFeeCents: number; discountCents: number }): number {
  return Math.max(0, a.subtotalCents + a.travelFeeCents - a.discountCents);
}

export function serialize(a: FullAppointment) {
  return {
    id: a.id,
    date: a.date,
    startMin: a.startMin,
    endMin: a.endMin,
    dateLabel: formatDate(a.date),
    timeLabel: `${formatTime(a.startMin)} – ${formatTime(a.endMin)}`,
    status: a.status,
    source: a.source,
    locationType: a.locationType,
    address: a.address,
    postalCode: a.postalCode,
    notes: a.notes,
    stylist: a.stylist,
    customer: a.user
      ? { id: a.user.id as string | null, name: a.user.name, email: a.user.email.endsWith("@no-email.invalid") ? null : (a.user.email as string | null), phone: a.user.phone, registered: true }
      : { id: null, name: a.guestName ?? "Walk-in client", email: a.guestEmail, phone: a.guestPhone ?? "", registered: false },
    items: a.items.map((i) => ({
      id: i.id,
      name: i.name,
      durationMin: i.durationMin,
      priceLabel: i.priceCents == null ? "Quote at visit" : formatMoney(i.priceCents),
      isCustom: i.isCustom,
    })),
    totalCents: amountDue(a),
    subtotalLabel: formatMoney(a.subtotalCents),
    travelFeeLabel: a.travelFeeCents ? formatMoney(a.travelFeeCents) : null,
    discountLabel: a.discountCents ? `−${formatMoney(a.discountCents)}` : null,
    offerTitle: a.offerTitle,
    totalLabel: formatMoney(amountDue(a)) + (a.hasCustom ? " + quote" : ""),
    paymentStatus: a.paymentStatus,
    paymentLabel: PAYMENT_LABEL[a.paymentStatus] ?? a.paymentStatus,
    paidLabel: a.paidCents ? formatMoney(a.paidCents) : null,
    canPayOnline: a.paymentStatus !== "PAID_ONLINE" && a.paymentStatus !== "PAID_IN_SALON" && a.paymentStatus !== "REFUNDED" && amountDue(a) > 0 && (ACTIVE_STATUSES as readonly string[]).includes(a.status),
    rescheduleCount: a.rescheduleCount,
    isActive: (ACTIVE_STATUSES as readonly string[]).includes(a.status),
    isPast: minutesUntil(a.date, a.endMin) < 0,
    canChange: canClientChange(a) && a.rescheduleCount < BOOKING_RULES.maxReschedules,
    canCancel: canClientChange(a),
    createdAt: a.createdAt.toISOString(),
  };
}

export type AppointmentDTO = ReturnType<typeof serialize>;

export function summaryText(a: AppointmentDTO): string {
  return [
    `When: ${a.dateLabel}, ${a.timeLabel}`,
    `Where: ${a.locationType === "HOME" ? `At home — ${a.address}, ${a.postalCode}` : "In the salon"}`,
    `Stylist: ${a.stylist?.name ?? "To be assigned"}`,
    `Services: ${a.items.map((i) => i.name).join(", ")}`,
    ...(a.offerTitle ? [`Offer applied: ${a.offerTitle} (${a.discountLabel})`] : []),
    `Estimated total: ${a.totalLabel}`,
    `Payment: ${a.paymentLabel}`,
  ].join("\n");
}

/** Active stylists for dropdowns (book / reschedule pages). */
export async function stylistOptions(db: DB) {
  return db
    .select({ id: stylists.id, name: stylists.name, title: stylists.title })
    .from(stylists)
    .where(eq(stylists.active, true))
    .orderBy(stylists.name);
}
