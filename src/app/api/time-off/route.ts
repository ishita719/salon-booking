import { and, asc, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireTeam, route } from "@/lib/api";
import { ACTIVE_STATUSES } from "@/lib/config";
import { formatDate, formatTime, salonNow } from "@/lib/time";
import { timeOffSchema } from "@/lib/validation";

const { timeOff, stylists, appointments } = schema;

function label(o: { date: string; startMin: number; endMin: number }) {
  const allDay = o.startMin === 0 && o.endMin >= 1440;
  return `${formatDate(o.date)} · ${allDay ? "All day" : `${formatTime(o.startMin)} – ${formatTime(o.endMin)}`}`;
}

// Staff see their own upcoming time off; the owner sees everyone's.
export const GET = route(async () => {
  const user = await requireTeam();
  const conds = [gte(timeOff.date, salonNow().date)];
  if (user.role === "STAFF") conds.push(eq(timeOff.stylistId, user.stylistId!));
  const list = await getDb()
    .select({ o: timeOff, stylistName: stylists.name })
    .from(timeOff)
    .innerJoin(stylists, eq(stylists.id, timeOff.stylistId))
    .where(and(...conds))
    .orderBy(asc(timeOff.date), asc(timeOff.startMin));
  return NextResponse.json({
    timeOff: list.map(({ o, stylistName }) => ({ id: o.id, stylistId: o.stylistId, stylistName, reason: o.reason, label: label(o), date: o.date })),
  });
});

export const POST = route(async (req) => {
  const user = await requireTeam();
  const data = timeOffSchema.parse(await req.json());
  const stylistId = user.role === "STAFF" ? user.stylistId! : data.stylistId;
  if (!stylistId) throw new ApiError(400, "Choose a team member.");
  if (data.date < salonNow().date) throw new ApiError(400, "That date is in the past.");
  const db = getDb();
  if (!(await db.query.stylists.findFirst({ where: eq(stylists.id, stylistId), columns: { id: true } }))) throw new ApiError(404, "Team member not found.");

  // Don't silently leave clients stranded: refuse if bookings already exist in that window.
  const clash = await db
    .select({ startMin: appointments.startMin })
    .from(appointments)
    .where(
      and(
        eq(appointments.stylistId, stylistId),
        eq(appointments.date, data.date),
        inArray(appointments.status, [...ACTIVE_STATUSES]),
        lt(appointments.startMin, data.endMin),
        gt(appointments.endMin, data.startMin),
      ),
    );
  if (clash.length) {
    throw new ApiError(
      409,
      `There ${clash.length === 1 ? "is 1 booking" : `are ${clash.length} bookings`} in that time (${clash.map((c) => formatTime(c.startMin)).join(", ")}). Move or cancel ${clash.length === 1 ? "it" : "them"} first.`,
    );
  }
  const [created] = await db
    .insert(timeOff)
    .values({ stylistId, date: data.date, startMin: data.startMin, endMin: data.endMin, reason: data.reason })
    .returning({ id: timeOff.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
});
