import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, isTeam, requireUser, route } from "@/lib/api";
import { computeSlots, dateProblem } from "@/lib/availability";
import { busyBlocks, canAccess, candidateStylists } from "@/lib/bookings";
import { prisma } from "@/lib/db";
import { formatTime } from "@/lib/time";
import { dateSchema, locationSchema } from "@/lib/validation";

const querySchema = z.object({
  date: dateSchema,
  duration: z.coerce.number().int().min(15).max(720),
  location: locationSchema,
  stylistId: z.string().max(40).optional(),
  excludeId: z.string().max(40).optional(),
});

// GET /api/availability?date=2026-11-20&duration=90&location=SALON[&stylistId=..][&excludeId=..]
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  // excludeId lets someone reschedule without the booking blocking itself.
  if (q.excludeId) {
    const own = await prisma.appointment.findUnique({ where: { id: q.excludeId }, select: { userId: true, stylistId: true } });
    if (!own || !canAccess(user, own)) throw new ApiError(404, "Appointment not found.");
  }

  const problem = dateProblem(q.date);
  if (problem) return NextResponse.json({ slots: [], message: problem });

  const { ids, message } = await candidateStylists(prisma, q.date, q.stylistId || null);
  if (!ids.length) return NextResponse.json({ slots: [], message });
  const busy = await busyBlocks(prisma, q.date, q.excludeId);
  const slots = computeSlots({
    date: q.date,
    durationMin: q.duration,
    locationType: q.location,
    stylistIds: ids,
    busy,
    minNoticeMin: isTeam(user) ? 0 : undefined, // the salon can book walk-ins right away
  });

  return NextResponse.json({
    slots: slots.map((s) => ({ startMin: s.startMin, label: formatTime(s.startMin) })),
    message: slots.length ? null : "No times left that day — please try another date.",
  });
});
