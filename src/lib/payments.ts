import { eq } from "drizzle-orm";
import { DB, schema } from "@/db";
import { CheckoutSession } from "./stripe";

/** Marks an appointment paid from a Stripe Checkout session (idempotent). Returns the appointment id, or null. */
export async function applyPaidSession(db: DB, session: CheckoutSession): Promise<string | null> {
  const apptId = session.metadata?.appointment_id ?? session.client_reference_id;
  if (!apptId || session.payment_status !== "paid") return null;
  const appt = await db.query.appointments.findFirst({ where: eq(schema.appointments.id, apptId) });
  if (!appt) return null;
  // Only accept the session we created for this appointment.
  if (appt.stripeSessionId && appt.stripeSessionId !== session.id) return null;
  if (appt.paymentStatus !== "PAID_ONLINE") {
    await db
      .update(schema.appointments)
      .set({ paymentStatus: "PAID_ONLINE", paidCents: session.amount_total ?? 0, paidAt: new Date(), stripeSessionId: session.id })
      .where(eq(schema.appointments.id, apptId));
  }
  return apptId;
}
