import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ownerCodeSchema } from "@/lib/validation";

// Owner: is the temporary code still in use?
export const GET = route(async () => {
  const me = await requireOwner();
  const u = await getDb().query.users.findFirst({ where: eq(schema.users.id, me.id), columns: { pinHash: true } });
  return NextResponse.json({ usingTemporary: !u?.pinHash });
});

// Owner: set a new personal owner code (confirm with your password).
export const PATCH = route(async (req) => {
  const me = await requireOwner();
  rateLimit(`owner-code:${me.id}`, 10, 15 * 60 * 1000);
  const { currentPassword, newCode } = z.object({ currentPassword: z.string().min(1, "Enter your password").max(100), newCode: ownerCodeSchema }).parse(await req.json());
  const db = getDb();
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!u || !(await verifyPassword(currentPassword, u.passwordHash))) throw new ApiError(400, "Password is incorrect.");
  await db.update(schema.users).set({ pinHash: await hashPassword(newCode) }).where(eq(schema.users.id, me.id));
  return NextResponse.json({ ok: true });
});
