// Business settings — change these to match the real salon.

export const SALON = {
  name: "Maple & Mane Studio",
  tagline: "Hair, skin & nails in Vancouver — in our studio or at your door.",
  address: "1200 Main Street, Vancouver, BC (demo address)",
  phone: "(604) 555-0123",
  email: "hello@example.com",
  timeZone: "America/Vancouver",
};

/** Opening hours by weekday (0 = Sunday). Minutes after midnight. null = closed. */
export const HOURS: Record<number, { open: number; close: number } | null> = {
  0: { open: 10 * 60, close: 17 * 60 }, // Sun 10:00–17:00
  1: null, // Mon closed
  2: { open: 9 * 60, close: 19 * 60 }, // Tue 9:00–19:00
  3: { open: 9 * 60, close: 19 * 60 },
  4: { open: 9 * 60, close: 20 * 60 }, // Thu late night
  5: { open: 9 * 60, close: 20 * 60 },
  6: { open: 9 * 60, close: 18 * 60 }, // Sat
};

export const BOOKING_RULES = {
  slotStepMin: 30, // start times every 30 minutes
  minNoticeMin: 120, // book at least 2 hours ahead
  maxDaysAhead: 60, // book up to 60 days out
  changeCutoffHours: 12, // clients can reschedule/cancel until 12h before
  maxReschedules: 3,
  customServiceDurationMin: 60, // time reserved for a typed-in service
  maxServicesPerBooking: 6,
};

export const HOME_VISITS = {
  travelFeeCents: 2500, // $25 flat travel fee
  travelBufferMin: 30, // stylist travel time blocked before and after
  // Postal code prefixes we travel to (Vancouver, Burnaby, North Shore, Richmond).
  postalPrefixes: ["V5", "V6", "V7", "V3J", "V3N"],
  areaLabel: "Vancouver, Burnaby, North Vancouver, West Vancouver & Richmond",
};

export const ACTIVE_STATUSES = ["BOOKED", "CONFIRMED"] as const;
export const ALL_STATUSES = ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof ALL_STATUSES)[number];
