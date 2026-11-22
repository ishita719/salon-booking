import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, requireUser, route } from "@/lib/api";
import { amountDue, loadAppointment, serialize } from "@/lib/bookings";
import { rateLimit } from "@/lib/rate-limit";
import { createCheckoutSession, stripeEnabled } from "@/lib/stripe";

// Client pays an existing booking online (e.g. chose "pay at salon" first, or the first attempt was cancelled).
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.role !== "CUSTOMER") throw new ApiError(403, "Only clients pay online.");
  rateLimit(`pay:${user.id}:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const { appointmentId } = z.object({ appointmentId: z.string().min(1).max(64) }).parse(await req.json());
  if (!stripeEnabled()) throw new ApiError(400, "Online payment isn't available right now — you can pay at the salon.");

  const db = getDb();
  const appt = await loadAppointment(db, appointmentId);
  if (!appt || appt.userId !== user.id) throw new ApiError(404, "Appointment not found.");
  if (!serialize(appt).canPayOnline) throw new ApiError(400, "This appointment doesn't need an online payment.");

  const session = await createCheckoutSession({
    appointmentId: appt.id,
    amountCents: amountDue(appt),
    description: `${appt.date} · ${appt.items.map((i) => i.name).join(", ")}`,
    email: user.email,
    origin: new URL(req.url).origin,
  });
  await db.update(schema.appointments).set({ paymentStatus: "PENDING", stripeSessionId: session.id }).where(eq(schema.appointments.id, appt.id));
  return NextResponse.json({ url: session.url });
});
