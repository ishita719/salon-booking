import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { offerSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = offerSchema.parse(await req.json());
  const [row] = await getDb().update(schema.offers).set(data).where(eq(schema.offers.id, id)).returning({ id: schema.offers.id });
  if (!row) throw new ApiError(404, "Offer not found.");
  return NextResponse.json({ ok: true });
});

// Past bookings keep the offer title and discount they got, so deleting an offer is safe.
export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const [row] = await getDb().delete(schema.offers).where(eq(schema.offers.id, id)).returning({ id: schema.offers.id });
  if (!row) throw new ApiError(404, "Offer not found.");
  return NextResponse.json({ ok: true });
});
