import { NextResponse } from "next/server";
import { ApiError, requireTeam, route } from "@/lib/api";
import { ACTIVE_STATUSES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { formatDate, formatTime, salonNow } from "@/lib/time";
import { timeOffSchema } from "@/lib/validation";

function label(o: { date: string; startMin: number; endMin: number }) {
  const allDay = o.startMin === 0 && o.endMin >= 1440;
  return `${formatDate(o.date)} · ${allDay ? "All day" : `${formatTime(o.startMin)} – ${formatTime(o.endMin)}`}`;
}

// Staff see their own upcoming time off; the owner sees everyone's.
export const GET = route(async () => {
  const user = await requireTeam();
  const list = await prisma.timeOff.findMany({
    where: { date: { gte: salonNow().date }, ...(user.role === "STAFF" ? { stylistId: user.stylistId! } : {}) },
    include: { stylist: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { startMin: "asc" }],
  });
  return NextResponse.json({
    timeOff: list.map((o) => ({ id: o.id, stylistId: o.stylistId, stylistName: o.stylist.name, reason: o.reason, label: label(o), date: o.date })),
  });
});

export const POST = route(async (req) => {
  const user = await requireTeam();
  const data = timeOffSchema.parse(await req.json());
  const stylistId = user.role === "STAFF" ? user.stylistId! : data.stylistId;
  if (!stylistId) throw new ApiError(400, "Choose a team member.");
  if (data.date < salonNow().date) throw new ApiError(400, "That date is in the past.");
  const stylist = await prisma.stylist.findUnique({ where: { id: stylistId }, select: { id: true } });
  if (!stylist) throw new ApiError(404, "Team member not found.");

  // Don't silently leave clients stranded: refuse if bookings already exist in that window.
  const clash = await prisma.appointment.findMany({
    where: { stylistId, date: data.date, status: { in: [...ACTIVE_STATUSES] }, startMin: { lt: data.endMin }, endMin: { gt: data.startMin } },
    select: { startMin: true },
  });
  if (clash.length) {
    throw new ApiError(
      409,
      `There ${clash.length === 1 ? "is 1 booking" : `are ${clash.length} bookings`} in that time (${clash.map((c) => formatTime(c.startMin)).join(", ")}). Move or cancel ${clash.length === 1 ? "it" : "them"} first.`,
    );
  }
  const created = await prisma.timeOff.create({
    data: { stylistId, date: data.date, startMin: data.startMin, endMin: data.endMin, reason: data.reason },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
});
