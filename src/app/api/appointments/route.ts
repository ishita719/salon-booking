import { and, asc, count, desc, eq, gte, inArray, isNull, lte, SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, isTeam, requireUser, route } from "@/lib/api";
import { amountDue, buildItems, hydrate, loadAppointment, lostRace, pickStylistForSlot, serialize, summaryText } from "@/lib/bookings";
import { bestOffer, isFirstVisit, liveOffers } from "@/lib/offers";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";
import { ACTIVE_STATUSES, ALL_STATUSES, SALON } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, salonNow } from "@/lib/time";
import { bookingSchema, dateSchema } from "@/lib/validation";

const { appointments, appointmentItems, users, services } = schema;

const listQuery = z.object({
  date: dateSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(ALL_STATUSES).optional(),
  upcoming: z.enum(["1"]).optional(),
  // owner-only filters
  stylistId: z.string().max(64).optional(),
  clientId: z.string().max(64).optional(),
  guestPhone: z.string().max(30).optional(),
});

// GET: what you see depends on who you are.
//  client → their own bookings · staff → bookings assigned to them · owner → everything (with filters)
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = listQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const today = salonNow().date;

  const conds: SQL[] = [];
  if (user.role === "CUSTOMER") conds.push(eq(appointments.userId, user.id));
  else if (user.role === "STAFF") conds.push(eq(appointments.stylistId, user.stylistId ?? "__none__"));
  else {
    if (q.stylistId) conds.push(eq(appointments.stylistId, q.stylistId));
    if (q.clientId) conds.push(eq(appointments.userId, q.clientId));
    if (q.guestPhone) conds.push(isNull(appointments.userId), eq(appointments.guestPhone, q.guestPhone));
  }
  if (q.upcoming) {
    conds.push(gte(appointments.date, today), lte(appointments.date, addDays(today, 90)), inArray(appointments.status, [...ACTIVE_STATUSES]));
  } else {
    if (q.date) conds.push(eq(appointments.date, q.date));
    else if (q.from || q.to) conds.push(gte(appointments.date, q.from ?? "0000-00-00"), lte(appointments.date, q.to ?? "9999-12-31"));
    if (q.status) conds.push(eq(appointments.status, q.status));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(appointments)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(user.role === "CUSTOMER" ? desc(appointments.date) : asc(appointments.date), asc(appointments.startMin))
    .limit(500);
  return NextResponse.json({ appointments: (await hydrate(db, rows)).map(serialize) });
});

// POST: create a booking. Clients book for themselves; staff/owner book on behalf of a client.
export const POST = route(async (req) => {
  const user = await requireUser();
  const team = isTeam(user);
  rateLimit(`book:${user.id}:${clientIp(req)}`, team ? 200 : 15, 60 * 60 * 1000);
  const data = bookingSchema.parse(await req.json());
  const db = getDb();

  // Who the appointment is for.
  let forWho: { userId: string | null; guestName?: string; guestPhone?: string; guestEmail?: string | null; email: string | null; name: string };
  if (team) {
    if (!data.client) throw new ApiError(400, "Enter the client's name and phone number.");
    const email = data.client.email || null;
    const registered = email
      ? await db.query.users.findFirst({ where: and(eq(users.email, email), eq(users.role, "CUSTOMER"), eq(users.active, true)) })
      : undefined;
    forWho = registered
      ? { userId: registered.id, email: registered.email, name: registered.name }
      : { userId: null, guestName: data.client.name, guestPhone: data.client.phone, guestEmail: email, email, name: data.client.name };
  } else {
    // Limit how many open bookings one client account can hold (stops spam / slot hoarding).
    const [{ n }] = await db
      .select({ n: count() })
      .from(appointments)
      .where(and(eq(appointments.userId, user.id), inArray(appointments.status, [...ACTIVE_STATUSES]), gte(appointments.date, salonNow().date)));
    if (n >= 5) throw new ApiError(400, "You already have 5 upcoming appointments. Please contact the salon to book more.");
    forWho = { userId: user.id, email: user.email, name: user.name };
  }

  const priced = await buildItems(db, data.serviceIds, data.customServices, data.locationType);

  // Best live offer for the chosen services (offers don't stack).
  const svcRows = data.serviceIds.length ? await db.select().from(services).where(inArray(services.id, data.serviceIds)) : [];
  const offer = bestOffer(await liveOffers(db), svcRows, await isFirstVisit(db, forWho.userId));
  const stylistId = await pickStylistForSlot(db, {
    date: data.date,
    startMin: data.startMin,
    durationMin: priced.durationMin,
    locationType: data.locationType,
    stylistId: data.stylistId,
    minNoticeMin: team ? 0 : undefined,
  });

  const id = crypto.randomUUID();
  const now = new Date();
  // Appointment + its line items are written together in one atomic batch.
  await db.batch([
    db.insert(appointments).values({
      id,
      userId: forWho.userId,
      guestName: forWho.guestName ?? null,
      guestPhone: forWho.guestPhone ?? null,
      guestEmail: forWho.guestEmail ?? null,
      source: team ? "STAFF" : "ONLINE",
      stylistId,
      date: data.date,
      startMin: data.startMin,
      endMin: data.startMin + priced.durationMin,
      locationType: data.locationType,
      address: data.address ?? null,
      postalCode: data.postalCode ?? null,
      notes: data.notes || null,
      subtotalCents: priced.subtotalCents,
      travelFeeCents: priced.travelFeeCents,
      hasCustom: priced.hasCustom,
      discountCents: offer?.discountCents ?? 0,
      offerId: offer?.offer.id ?? null,
      offerTitle: offer?.offer.title ?? null,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(appointmentItems).values(priced.items.map((i) => ({ ...i, appointmentId: id }))),
  ]);

  // Two people may have picked the same slot at the same moment: the first one saved keeps it.
  if (await lostRace(db, { id, stylistId, date: data.date, startMin: data.startMin, endMin: data.startMin + priced.durationMin, locationType: data.locationType, createdAt: now })) {
    await db.delete(appointments).where(eq(appointments.id, id));
    throw new ApiError(409, "Sorry, someone just booked that time. Please pick another.");
  }

  // "Pay online now": send the client to Stripe's secure checkout. If that fails, the booking stays (pay at salon).
  let checkoutUrl: string | null = null;
  let paymentNote: string | null = null;
  if (data.payOnline && !team) {
    const due = amountDue({ subtotalCents: priced.subtotalCents, travelFeeCents: priced.travelFeeCents, discountCents: offer?.discountCents ?? 0 });
    if (!stripeEnabled()) paymentNote = "Online payment isn't available right now — you can pay at the salon.";
    else if (due > 0) {
      try {
        const session = await createCheckoutSession({
          appointmentId: id,
          amountCents: due,
          description: `${data.date} · ${priced.items.map((i) => i.name).join(", ")}`,
          email: forWho.email,
          origin: new URL(req.url).origin,
        });
        await db.update(appointments).set({ paymentStatus: "PENDING", stripeSessionId: session.id }).where(eq(appointments.id, id));
        checkoutUrl = session.url;
      } catch (e) {
        console.error("Stripe checkout failed", e);
        paymentNote = "We couldn't start online payment — your booking is saved and you can pay at the salon or try again from My appointments.";
      }
    }
  }

  const dto = serialize((await loadAppointment(db, id))!);
  if (forWho.email) {
    await sendEmail(
      forWho.email,
      `Booking confirmed — ${dto.dateLabel}`,
      `Hi ${forWho.name},\n\nThanks for booking with ${SALON.name}!\n\n${summaryText(dto)}\n\nNeed to change it? Call us at ${SALON.phone}${forWho.userId ? " or manage it from your account" : ""}.`,
    );
  }
  return NextResponse.json({ appointment: dto, checkoutUrl, paymentNote }, { status: 201 });
});
