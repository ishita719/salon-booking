// Booking business logic shared by the API routes.

import type { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import type { SessionUser } from "./auth";
import { BusyBlock, computeSlots, dateProblem, LocationType } from "./availability";
import { ACTIVE_STATUSES, BOOKING_RULES, HOME_VISITS } from "./config";
import { prisma } from "./db";
import { formatDate, formatMoney, formatTime, minutesUntil, weekdayOf } from "./time";

type Tx = Prisma.TransactionClient;

export function parseWorkDays(s: string): number[] {
  return s
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function worksOn(workDays: string, date: string): boolean {
  return parseWorkDays(workDays).includes(weekdayOf(date));
}

/** Existing appointments AND staff time off for a day, as blocks that make a stylist busy. */
export async function busyBlocks(tx: Tx, date: string, excludeId?: string): Promise<BusyBlock[]> {
  const [appts, off] = await Promise.all([
    tx.appointment.findMany({
      where: { date, status: { in: [...ACTIVE_STATUSES] }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { stylistId: true, startMin: true, endMin: true, locationType: true },
    }),
    tx.timeOff.findMany({ where: { date }, select: { stylistId: true, startMin: true, endMin: true } }),
  ]);
  return [...appts, ...off.map((o) => ({ ...o, locationType: "SALON" }))];
}

/** Active stylists who work on that weekday (optionally only one specific stylist). */
export async function candidateStylists(tx: Tx, date: string, stylistId?: string | null): Promise<{ ids: string[]; message: string | null }> {
  if (stylistId) {
    const s = await tx.stylist.findFirst({ where: { id: stylistId, active: true } });
    if (!s) throw new ApiError(400, "That stylist is not available.");
    if (!worksOn(s.workDays, date)) return { ids: [], message: `${s.name} doesn't work that day — try another day or "Any available stylist".` };
    return { ids: [s.id], message: null };
  }
  const all = await tx.stylist.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const ids = all.filter((s) => worksOn(s.workDays, date)).map((s) => s.id);
  return { ids, message: ids.length ? null : "No stylists are working that day." };
}

/** Confirms the slot is still free (inside the transaction) and returns the stylist to assign. */
export async function claimSlot(
  tx: Tx,
  o: {
    date: string;
    startMin: number;
    durationMin: number;
    locationType: LocationType;
    stylistId?: string | null;
    excludeId?: string;
    minNoticeMin?: number;
  },
): Promise<string> {
  const problem = dateProblem(o.date);
  if (problem) throw new ApiError(400, problem);
  const { ids, message } = await candidateStylists(tx, o.date, o.stylistId);
  if (!ids.length) throw new ApiError(409, message ?? "No stylist available.");
  const busy = await busyBlocks(tx, o.date, o.excludeId);
  const slot = computeSlots({
    date: o.date,
    durationMin: o.durationMin,
    locationType: o.locationType,
    stylistIds: ids,
    busy,
    minNoticeMin: o.minNoticeMin,
  }).find((s) => s.startMin === o.startMin);
  if (!slot) throw new ApiError(409, "Sorry, that time was just taken or is no longer available. Please pick another.");
  // Spread work evenly: pick the free stylist with the fewest bookings that day.
  const load = (id: string) => busy.filter((b) => b.stylistId === id).length;
  return [...slot.stylistIds].sort((a, b) => load(a) - load(b))[0];
}

/** Turns selected service ids + typed-in services into priced line items. */
export async function buildItems(serviceIds: string[], customServices: string[], locationType: LocationType) {
  const services = serviceIds.length ? await prisma.service.findMany({ where: { id: { in: serviceIds }, active: true } }) : [];
  if (services.length !== serviceIds.length) throw new ApiError(400, "One of the selected services is no longer offered.");
  if (locationType === "HOME") {
    const notHome = services.find((s) => !s.homeAvailable);
    if (notHome) throw new ApiError(400, `"${notHome.name}" is only available in the salon.`);
  }
  const items = [
    ...services.map((s) => ({ serviceId: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, isCustom: false })),
    ...customServices.map((name) => ({
      serviceId: null,
      name,
      durationMin: BOOKING_RULES.customServiceDurationMin,
      priceCents: null,
      isCustom: true,
    })),
  ];
  return {
    items,
    durationMin: items.reduce((t, i) => t + i.durationMin, 0),
    subtotalCents: items.reduce((t, i) => t + (i.priceCents ?? 0), 0),
    travelFeeCents: locationType === "HOME" ? HOME_VISITS.travelFeeCents : 0,
    hasCustom: customServices.length > 0,
  };
}

export const appointmentInclude = {
  items: true,
  stylist: { select: { id: true, name: true } },
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.AppointmentInclude;

type FullAppointment = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

/** Who may see/manage an appointment: the owner, the client who booked it, or the stylist assigned to it. */
export function canAccess(user: SessionUser, a: { userId: string | null; stylistId: string | null }): boolean {
  if (user.role === "OWNER") return true;
  if (user.role === "STAFF") return !!user.stylistId && a.stylistId === user.stylistId;
  return a.userId === user.id;
}

export function canClientChange(a: { status: string; date: string; startMin: number }): boolean {
  return (
    (ACTIVE_STATUSES as readonly string[]).includes(a.status) &&
    minutesUntil(a.date, a.startMin) >= BOOKING_RULES.changeCutoffHours * 60
  );
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
      ? { id: a.user.id as string | null, name: a.user.name, email: a.user.email as string | null, phone: a.user.phone, registered: true }
      : { id: null, name: a.guestName ?? "Walk-in client", email: a.guestEmail, phone: a.guestPhone ?? "", registered: false },
    items: a.items.map((i) => ({
      id: i.id,
      name: i.name,
      durationMin: i.durationMin,
      priceLabel: i.priceCents == null ? "Quote at visit" : formatMoney(i.priceCents),
      isCustom: i.isCustom,
    })),
    totalCents: a.subtotalCents + a.travelFeeCents,
    subtotalLabel: formatMoney(a.subtotalCents),
    travelFeeLabel: a.travelFeeCents ? formatMoney(a.travelFeeCents) : null,
    totalLabel: formatMoney(a.subtotalCents + a.travelFeeCents) + (a.hasCustom ? " + quote" : ""),
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
    `Estimated total: ${a.totalLabel}`,
  ].join("\n");
}
