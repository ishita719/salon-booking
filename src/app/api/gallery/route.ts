import { asc, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { requireOwner, route } from "@/lib/api";
import { galleryItemSchema } from "@/lib/validation";

const { gallery } = schema;

// Public: gallery items (photos are served separately from /api/gallery/<id>/image so this list stays small).
export const GET = route(async () => {
  const rows = await getDb()
    .select({ id: gallery.id, title: gallery.title, category: gallery.category, description: gallery.description, stylistId: gallery.stylistId, sort: gallery.sort, hasImage: sql<number>`(${gallery.image} IS NOT NULL)` })
    .from(gallery)
    .orderBy(asc(gallery.sort), desc(gallery.createdAt));
  return NextResponse.json({ items: rows.map((r) => ({ ...r, hasImage: !!r.hasImage })) });
});

export const POST = route(async (req) => {
  await requireOwner();
  const data = galleryItemSchema.parse(await req.json());
  const [g] = await getDb().insert(gallery).values(data).returning({ id: gallery.id });
  return NextResponse.json({ id: g.id }, { status: 201 });
});
