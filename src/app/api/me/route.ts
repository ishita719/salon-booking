import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { requireUser, route } from "@/lib/api";
import { profileSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const data = profileSchema.parse(await req.json());
  const db = getDb();
  await db.update(schema.users).set(data).where(eq(schema.users.id, user.id));
  // Keep a staff member's public name in sync with their profile.
  if (user.role === "STAFF") await db.update(schema.stylists).set({ name: data.name }).where(eq(schema.stylists.userId, user.id));
  return NextResponse.json({ user: { ...user, ...data } });
});
