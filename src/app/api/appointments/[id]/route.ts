import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, isTeam, requireUser, route } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { amountDue, canAccess, canClientChange, FullAppointment, loadAppointment, lostRace, pickStylistForSlot, serialize, summaryText } from "@/lib/bookings";
import { ACTIVE_STATUSES, BOOKING_RULES, SALON } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { appointmentPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const { appointments } = schema;

/** Loads an appointment the user may see. 404 otherwise — never reveal that other bookings exist. */
async function loadAllowed(id: string, user: SessionUser) {
  const appt = await loadAppointment(getDb(), id);
  if (!appt || !canAccess(user, appt)) throw new ApiError(404, "Appointment not found.");
  return appt;
}

function clientEmail(a: FullAppointment) {
  return a.user ? { to: a.user.email, name: a.user.name } : a.guestEmail ? { to: a.guestEmail, name: a.guestName ?? "there" } : null;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  return NextResponse.json({ appointment: serialize(await loadAllowed((await params).id, user)) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  const db = getDb();
  const appt = await loadAllowed(id, user);
  const team = isTeam(user); // owner, or the stylist assigned to this booking
  const body = appointmentPatchSchema.parse(await req.json());
  const to = clientEmail(appt);
  const reload = async () => serialize((await loadAppointment(db, id))!);

  if (body.action === "status") {
    if (!team) throw new ApiError(403, "Only the salon can change the status.");
    await db
      .update(appointments)
      .set({ status: body.status, cancelledAt: body.status === "CANCELLED" ? new Date() : null })
      .where(eq(appointments.id, id));
    return NextResponse.json({ appointment: await reload() });
  }

  if (body.action === "payment") {
    if (!team) throw new ApiError(403, "Only the salon can record payments.");
    if (body.paymentStatus === "REFUNDED" && user.role !== "OWNER") throw new ApiError(403, "Only the owner can mark a refund.");
    if (appt.paymentStatus === "PAID_ONLINE" && body.paymentStatus !== "REFUNDED") {
      throw new ApiError(400, "This booking was paid online. Refund it in Stripe first, then mark it as refunded.");
    }
    const paid = body.paymentStatus === "PAID_IN_SALON" ? (body.paidCents ?? amountDue(appt)) : body.paymentStatus === "REFUNDED" ? appt.paidCents : 0;
    await db
      .update(appointments)
      .set({ paymentStatus: body.paymentStatus, paidCents: paid, paidAt: body.paymentStatus === "PAID_IN_SALON" ? new Date() : appt.paidAt })
      .where(eq(appointments.id, id));
    return NextResponse.json({ appointment: await reload() });
  }

  if (!(ACTIVE_STATUSES as readonly string[]).includes(appt.status)) throw new ApiError(400, "This appointment is no longer active.");
  if (!team && !canClientChange(appt)) {
    throw new ApiError(400, `Changes are allowed up to ${BOOKING_RULES.changeCutoffHours} hours before your appointment. Please call us at ${SALON.phone}.`);
  }

  if (body.action === "cancel") {
    await db.update(appointments).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(appointments.id, id));
    const dto = await reload();
    if (to) await sendEmail(to.to, `Appointment cancelled — ${dto.dateLabel}`, `Hi ${to.name},\n\nYour appointment has been cancelled.\n\n${summaryText(dto)}\n\nWe hope to see you soon!`);
    return NextResponse.json({ appointment: dto });
  }

  // Reschedule
  if (!team && appt.rescheduleCount >= BOOKING_RULES.maxReschedules) {
    throw new ApiError(400, `This appointment has been rescheduled ${BOOKING_RULES.maxReschedules} times. Please call the salon.`);
  }
  const durationMin = appt.endMin - appt.startMin;
  const locationType = appt.locationType === "HOME" ? "HOME" : "SALON";
  const stylistId = await pickStylistForSlot(db, {
    date: body.date,
    startMin: body.startMin,
    durationMin,
    locationType,
    stylistId: body.stylistId === undefined ? appt.stylistId : body.stylistId,
    excludeId: id,
    minNoticeMin: team ? 0 : undefined,
  });
  const previous = { date: appt.date, startMin: appt.startMin, endMin: appt.endMin, stylistId: appt.stylistId, status: appt.status, rescheduleCount: appt.rescheduleCount };
  await db
    .update(appointments)
    .set({
      date: body.date,
      startMin: body.startMin,
      endMin: body.startMin + durationMin,
      stylistId,
      status: "BOOKED",
      rescheduleCount: team ? appt.rescheduleCount : appt.rescheduleCount + 1,
    })
    .where(eq(appointments.id, id));
  // If someone grabbed the slot at the same moment, put the appointment back where it was.
  if (await lostRace(db, { id, stylistId, date: body.date, startMin: body.startMin, endMin: body.startMin + durationMin, locationType, createdAt: appt.createdAt }, true)) {
    await db.update(appointments).set(previous).where(eq(appointments.id, id));
    throw new ApiError(409, "Sorry, that time was just taken. Please pick another.");
  }
  const dto = await reload();
  if (to) await sendEmail(to.to, `Appointment rescheduled — ${dto.dateLabel}`, `Hi ${to.name},\n\nYour appointment has been moved.\n\n${summaryText(dto)}`);
  return NextResponse.json({ appointment: dto });
});

// DELETE: owner may delete any appointment; clients may remove cancelled/past ones from their history.
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  const appt = await loadAllowed(id, user);
  if (user.role === "STAFF") throw new ApiError(403, "Only the owner can delete appointments. You can cancel it instead.");
  if (user.role === "CUSTOMER") {
    const removable = appt.status === "CANCELLED" || serialize(appt).isPast;
    if (!removable) throw new ApiError(400, "Cancel the appointment first, then you can delete it.");
  }
  await getDb().delete(appointments).where(eq(appointments.id, id));
  return NextResponse.json({ ok: true });
});
