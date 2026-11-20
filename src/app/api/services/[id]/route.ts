import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { serviceSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const { services, appointmentItems } = schema;

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = serviceSchema.partial().parse(await req.json());
  const [service] = await getDb().update(services).set(data).where(eq(services.id, id)).returning();
  if (!service) throw new ApiError(404, "Service not found.");
  return NextResponse.json({ service });
});

// Services that were ever booked are hidden (deactivated) rather than deleted, to keep history intact.
export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const db = getDb();
  const found = await db.query.services.findFirst({ where: eq(services.id, id), columns: { id: true } });
  if (!found) throw new ApiError(404, "Service not found.");
  const [{ n }] = await db.select({ n: count() }).from(appointmentItems).where(eq(appointmentItems.serviceId, id));
  if (n > 0) {
    await db.update(services).set({ active: false }).where(eq(services.id, id));
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await db.delete(services).where(eq(services.id, id));
  return NextResponse.json({ ok: true, deleted: true });
});
