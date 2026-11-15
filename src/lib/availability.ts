// Slot calculation. Pure functions (no database) so they are easy to test.

import { BOOKING_RULES, HOME_VISITS, HOURS } from "./config";
import { daysBetween, salonNow, weekdayOf } from "./time";

export type LocationType = "SALON" | "HOME";

export interface BusyBlock {
  stylistId: string | null;
  startMin: number;
  endMin: number;
  locationType: string;
}

export interface Slot {
  startMin: number;
  stylistIds: string[]; // stylists free for this start time
}

function bufferFor(locationType: string): number {
  return locationType === "HOME" ? HOME_VISITS.travelBufferMin : 0;
}

/** Reasons a date can't be booked at all, or null if the date is bookable. */
export function dateProblem(date: string, now: Date = new Date()): string | null {
  const today = salonNow(now).date;
  const diff = daysBetween(today, date);
  if (diff < 0) return "That date is in the past.";
  if (diff > BOOKING_RULES.maxDaysAhead)
    return `Bookings open up to ${BOOKING_RULES.maxDaysAhead} days ahead.`;
  if (!HOURS[weekdayOf(date)]) return "The salon is closed that day.";
  return null;
}

export function computeSlots(opts: {
  date: string;
  durationMin: number;
  locationType: LocationType;
  stylistIds: string[]; // candidate stylists
  busy: BusyBlock[]; // existing active appointments + staff time off that day
  now?: Date;
  minNoticeMin?: number; // staff booking walk-ins can use 0
}): Slot[] {
  const { date, durationMin, locationType, stylistIds, busy } = opts;
  const now = opts.now ?? new Date();
  if (durationMin <= 0 || stylistIds.length === 0) return [];
  if (dateProblem(date, now)) return [];

  const hours = HOURS[weekdayOf(date)]!;
  const n = salonNow(now);
  const notice = opts.minNoticeMin ?? BOOKING_RULES.minNoticeMin;
  const earliest = n.date === date ? n.minutes + notice : -Infinity;
  const buf = bufferFor(locationType);

  const slots: Slot[] = [];
  for (
    let start = hours.open;
    start + durationMin <= hours.close;
    start += BOOKING_RULES.slotStepMin
  ) {
    if (start < earliest) continue;
    const blockStart = start - buf;
    const blockEnd = start + durationMin + buf;

    const free = stylistIds.filter((sid) =>
      busy.every((b) => {
        // Unassigned appointments block nobody specific; assigned ones block their stylist.
        if (b.stylistId !== sid) return true;
        const bBuf = bufferFor(b.locationType);
        return blockEnd <= b.startMin - bBuf || blockStart >= b.endMin + bBuf;
      }),
    );
    if (free.length) slots.push({ startMin: start, stylistIds: free });
  }
  return slots;
}
