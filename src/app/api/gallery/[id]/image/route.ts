import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb, schema } from "@/db";

type Ctx = { params: Promise<{ id: string }> };

// Serves a gallery photo as a real image file (cached by browsers for a day).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const row = await getDb().query.gallery.findFirst({ where: eq(schema.gallery.id, id), columns: { image: true } });
  const m = row?.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return new Response("Not found", { status: 404 });
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
