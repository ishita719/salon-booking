import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { galleryItemSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const { gallery } = schema;

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = galleryItemSchema.partial().parse(await req.json());
  const [g] = await getDb().update(gallery).set(data).where(eq(gallery.id, id)).returning({ id: gallery.id });
  if (!g) throw new ApiError(404, "Photo not found.");
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const [g] = await getDb().delete(gallery).where(eq(gallery.id, id)).returning({ id: gallery.id });
  if (!g) throw new ApiError(404, "Photo not found.");
  return NextResponse.json({ ok: true });
});
