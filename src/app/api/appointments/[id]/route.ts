import { NextResponse } from "next/server";
import { ApiError, isTeam, requireUser, route } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { appointmentInclude, canAccess, canClientChange, claimSlot, serialize, summaryText } from "@/lib/bookings";
import { ACTIVE_STATUSES, BOOKING_RULES, SALON } from "@/lib/config";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appointmentPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Loads an appointment the user may see. 404 otherwise — never reveal that other bookings exist. */
async function loadAllowed(id: string, user: SessionUser) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include: appointmentInclude });
  if (!appt || !canAccess(user, appt)) throw new ApiError(404, "Appointment not found.");
  return appt;
}

function clientEmail(a: { user: { email: string; name: string } | null; guestEmail: string | null; guestName: string | null }) {
  return a.user ? { to: a.user.email, name: a.user.name } : a.guestEmail ? { to: a.guestEmail, name: a.guestName ?? "there" } : null;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const appt = await loadAllowed((await params).id, user);
  return NextResponse.json({ appointment: serialize(appt) });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  const appt = await loadAllowed(id, user);
  const team = isTeam(user); // owner, or the stylist assigned to this booking
  const body = appointmentPatchSchema.parse(await req.json());
  const to = clientEmail(appt);

  if (body.action === "status") {
    if (!team) throw new ApiError(403, "Only the salon can change the status.");
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: body.status, cancelledAt: body.status === "CANCELLED" ? new Date() : null },
      include: appointmentInclude,
    });
    return NextResponse.json({ appointment: serialize(updated) });
  }

  if (!(ACTIVE_STATUSES as readonly string[]).includes(appt.status)) {
    throw new ApiError(400, "This appointment is no longer active.");
  }
  if (!team && !canClientChange(appt)) {
    throw new ApiError(
      400,
      `Changes are allowed up to ${BOOKING_RULES.changeCutoffHours} hours before your appointment. Please call us at ${SALON.phone}.`,
    );
  }

  if (body.action === "cancel") {
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: appointmentInclude,
    });
    const dto = serialize(updated);
    if (to) await sendEmail(to.to, `Appointment cancelled — ${dto.dateLabel}`, `Hi ${to.name},\n\nYour appointment has been cancelled.\n\n${summaryText(dto)}\n\nWe hope to see you soon!`);
    return NextResponse.json({ appointment: dto });
  }

  // Reschedule
  if (!team && appt.rescheduleCount >= BOOKING_RULES.maxReschedules) {
    throw new ApiError(400, `This appointment has been rescheduled ${BOOKING_RULES.maxReschedules} times. Please call the salon.`);
  }
  const durationMin = appt.endMin - appt.startMin;
  const updated = await prisma.$transaction(
    async (tx) => {
      const stylistId = await claimSlot(tx, {
        date: body.date,
        startMin: body.startMin,
        durationMin,
        locationType: appt.locationType === "HOME" ? "HOME" : "SALON",
        stylistId: body.stylistId === undefined ? appt.stylistId : body.stylistId,
        excludeId: id,
        minNoticeMin: team ? 0 : undefined,
      });
      return tx.appointment.update({
        where: { id },
        data: {
          date: body.date,
          startMin: body.startMin,
          endMin: body.startMin + durationMin,
          stylistId,
          status: "BOOKED",
          rescheduleCount: team ? undefined : { increment: 1 },
        },
        include: appointmentInclude,
      });
    },
    { isolationLevel: "Serializable" },
  );
  const dto = serialize(updated);
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
  await prisma.appointment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
