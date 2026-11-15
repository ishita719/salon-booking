import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, clientIp, isTeam, requireUser, route } from "@/lib/api";
import { appointmentInclude, buildItems, claimSlot, serialize, summaryText } from "@/lib/bookings";
import { ACTIVE_STATUSES, ALL_STATUSES, SALON } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { addDays, salonNow } from "@/lib/time";
import { bookingSchema, dateSchema } from "@/lib/validation";

const listQuery = z.object({
  date: dateSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(ALL_STATUSES).optional(),
  upcoming: z.enum(["1"]).optional(),
  // owner-only filters
  stylistId: z.string().max(40).optional(),
  clientId: z.string().max(40).optional(),
  guestPhone: z.string().max(30).optional(),
});

// GET: what you see depends on who you are.
//  client → their own bookings · staff → bookings assigned to them · owner → everything (with filters)
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = listQuery.parse(Object.fromEntries(req.nextUrl.searchParams));
  const today = salonNow().date;

  const where: Prisma.AppointmentWhereInput = {};
  if (user.role === "CUSTOMER") where.userId = user.id;
  else if (user.role === "STAFF") where.stylistId = user.stylistId ?? "__none__";
  else {
    if (q.stylistId) where.stylistId = q.stylistId;
    if (q.clientId) where.userId = q.clientId;
    if (q.guestPhone) Object.assign(where, { userId: null, guestPhone: q.guestPhone });
  }
  if (q.date) where.date = q.date;
  else if (q.from || q.to) where.date = { gte: q.from ?? "0000-00-00", lte: q.to ?? "9999-12-31" };
  if (q.status) where.status = q.status;
  if (q.upcoming) {
    where.date = { gte: today, lte: addDays(today, 90) };
    where.status = { in: [...ACTIVE_STATUSES] };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: appointmentInclude,
    orderBy: [{ date: user.role === "CUSTOMER" ? "desc" : "asc" }, { startMin: "asc" }],
    take: 500,
  });
  return NextResponse.json({ appointments: appointments.map(serialize) });
});

// POST: create a booking. Clients book for themselves; staff/owner book on behalf of a client.
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`book:${user.id}:${clientIp(req)}`, isTeam(user) ? 200 : 15, 60 * 60 * 1000);
  const data = bookingSchema.parse(await req.json());
  const team = isTeam(user);

  // Who the appointment is for.
  let owner: { userId: string | null; guestName?: string; guestPhone?: string; guestEmail?: string | null; email: string | null; name: string };
  if (team) {
    if (!data.client) throw new ApiError(400, "Enter the client's name and phone number.");
    const email = data.client.email || null;
    const registered = email ? await prisma.user.findFirst({ where: { email, role: "CUSTOMER", active: true } }) : null;
    owner = registered
      ? { userId: registered.id, email: registered.email, name: registered.name }
      : { userId: null, guestName: data.client.name, guestPhone: data.client.phone, guestEmail: email, email, name: data.client.name };
  } else {
    // Limit how many open bookings one client account can hold (stops spam / slot hoarding).
    const openCount = await prisma.appointment.count({
      where: { userId: user.id, status: { in: [...ACTIVE_STATUSES] }, date: { gte: salonNow().date } },
    });
    if (openCount >= 5) throw new ApiError(400, "You already have 5 upcoming appointments. Please contact the salon to book more.");
    owner = { userId: user.id, email: user.email, name: user.name };
  }

  const priced = await buildItems(data.serviceIds, data.customServices, data.locationType);

  // Check + insert in one serializable transaction so two people can't grab the same slot.
  const created = await prisma.$transaction(
    async (tx) => {
      const stylistId = await claimSlot(tx, {
        date: data.date,
        startMin: data.startMin,
        durationMin: priced.durationMin,
        locationType: data.locationType,
        stylistId: data.stylistId,
        minNoticeMin: team ? 0 : undefined,
      });
      return tx.appointment.create({
        data: {
          userId: owner.userId,
          guestName: owner.guestName ?? null,
          guestPhone: owner.guestPhone ?? null,
          guestEmail: owner.guestEmail ?? null,
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
          items: { create: priced.items },
        },
        include: appointmentInclude,
      });
    },
    { isolationLevel: "Serializable" },
  );

  const dto = serialize(created);
  if (owner.email) {
    await sendEmail(
      owner.email,
      `Booking confirmed — ${dto.dateLabel}`,
      `Hi ${owner.name},\n\nThanks for booking with ${SALON.name}!\n\n${summaryText(dto)}\n\nNeed to change it? Call us at ${SALON.phone}${owner.userId ? " or manage it from your account" : ""}.`,
    );
  }
  return NextResponse.json({ appointment: dto }, { status: 201 });
});
