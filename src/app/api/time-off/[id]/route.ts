import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireTeam, route } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireTeam();
  const { id } = await params;
  const db = getDb();
  const entry = await db.query.timeOff.findFirst({ where: eq(schema.timeOff.id, id) });
  if (!entry || (user.role === "STAFF" && entry.stylistId !== user.stylistId)) throw new ApiError(404, "Not found.");
  await db.delete(schema.timeOff).where(eq(schema.timeOff.id, id));
  return NextResponse.json({ ok: true });
});
