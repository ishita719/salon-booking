import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { productSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = productSchema.partial().parse(await req.json());
  const [p] = await getDb().update(schema.products).set(data).where(eq(schema.products.id, id)).returning();
  if (!p) throw new ApiError(404, "Product not found.");
  return NextResponse.json({ product: p });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const [p] = await getDb().delete(schema.products).where(eq(schema.products.id, id)).returning({ id: schema.products.id });
  if (!p) throw new ApiError(404, "Product not found.");
  return NextResponse.json({ ok: true });
});
