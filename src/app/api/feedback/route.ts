import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, requireUser, route } from "@/lib/api";
import { listFeedback } from "@/lib/feedback";
import { rateLimit } from "@/lib/rate-limit";
import { formatDate, minutesUntil } from "@/lib/time";
import { feedbackSchema } from "@/lib/validation";

const { feedback, appointments, appointmentItems, stylists } = schema;

// GET: client → their own feedback + visits they can still rate · staff → feedback about them · owner → all
export const GET = route(async () => {
  const user = await requireUser();
  const db = getDb();

  if (user.role === "OWNER") return NextResponse.json({ feedback: await listFeedback(db) });
  if (user.role === "STAFF") {
    const list = await listFeedback(db, eq(feedback.stylistId, user.stylistId ?? "__none__"));
    // Staff see the review, never the client's email.
    return NextResponse.json({ feedback: list.map((f) => ({ ...f, clientName: f.clientShortName, clientEmail: null })) });
  }

  const mine = await listFeedback(db, eq(feedback.userId, user.id));
  const reviewed = new Set(mine.map((f) => f.appointmentId).filter(Boolean));
  const visits = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.userId, user.id), inArray(appointments.status, ["COMPLETED", "BOOKED", "CONFIRMED"])))
    .orderBy(desc(appointments.date))
    .limit(30);
  const finished = visits.filter((v) => !reviewed.has(v.id) && (v.status === "COMPLETED" || minutesUntil(v.date, v.endMin) < 0));
  const items = finished.length
    ? await db.select().from(appointmentItems).where(inArray(appointmentItems.appointmentId, finished.slice(0, 30).map((v) => v.id)))
    : [];
  const sty = finished.length ? await db.select({ id: stylists.id, name: stylists.name }).from(stylists) : [];
  return NextResponse.json({
    feedback: mine.map((f) => ({ ...f, clientEmail: null })),
    toReview: finished.map((v) => ({
      id: v.id,
      label: `${formatDate(v.date)} · ${items.filter((i) => i.appointmentId === v.id).map((i) => i.name).join(", ")}`,
      stylistName: sty.find((s) => s.id === v.stylistId)?.name ?? null,
    })),
  });
});

// POST: a client leaves feedback (optionally about one of their visits).
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.role !== "CUSTOMER") throw new ApiError(403, "Only clients can leave feedback.");
  rateLimit(`feedback:${user.id}:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const data = feedbackSchema.parse(await req.json());
  const db = getDb();

  let stylistId: string | null = null;
  if (data.appointmentId) {
    const appt = await db.query.appointments.findFirst({ where: and(eq(appointments.id, data.appointmentId), eq(appointments.userId, user.id)) });
    if (!appt) throw new ApiError(404, "Appointment not found.");
    const finished = appt.status === "COMPLETED" || ((appt.status === "BOOKED" || appt.status === "CONFIRMED") && minutesUntil(appt.date, appt.endMin) < 0);
    if (!finished) throw new ApiError(400, "You can rate a visit once it has happened.");
    if (await db.query.feedback.findFirst({ where: eq(feedback.appointmentId, appt.id), columns: { id: true } })) {
      throw new ApiError(409, "You've already left feedback for this visit — thank you!");
    }
    stylistId = appt.stylistId;
  }
  if (!data.comment && !data.appointmentId) throw new ApiError(400, "Please write a short comment.");

  const [created] = await db
    .insert(feedback)
    .values({ userId: user.id, appointmentId: data.appointmentId ?? null, stylistId, rating: data.rating, comment: data.comment })
    .returning({ id: feedback.id });
  return NextResponse.json({ id: created.id }, { status: 201 });
});
