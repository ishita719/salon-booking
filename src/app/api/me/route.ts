import { and, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireUser, route } from "@/lib/api";
import { hasPassword, phoneDigits, realEmail } from "@/lib/identity";
import { profileSchema } from "@/lib/validation";

async function me(id: string) {
  const u = await getDb().query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!u) throw new ApiError(401, "Please log in first.");
  return { id: u.id, name: u.name, phone: u.phone, role: u.role, email: realEmail(u.email), hasPassword: hasPassword(u.passwordHash) };
}

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user: await me(user.id) });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const data = profileSchema.parse(await req.json());
  const db = getDb();
  const set: Partial<typeof schema.users.$inferInsert> = { name: data.name, phone: data.phone, phoneDigits: phoneDigits(data.phone) };
  // Clients who signed up by QR without an email can add one (needed for "email me a login code").
  if (data.email && user.role === "CUSTOMER") {
    const taken = await db.query.users.findFirst({ where: and(eq(schema.users.email, data.email), ne(schema.users.id, user.id)), columns: { id: true } });
    if (taken) throw new ApiError(409, "That email is already used by another account.");
    set.email = data.email;
  }
  await db.update(schema.users).set(set).where(eq(schema.users.id, user.id));
  // Keep a staff member's public name in sync with their profile.
  if (user.role === "STAFF") await db.update(schema.stylists).set({ name: data.name }).where(eq(schema.stylists.userId, user.id));
  return NextResponse.json({ user: await me(user.id) });
});
