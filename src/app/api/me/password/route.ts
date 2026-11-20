import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireUser, route } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const me = await requireUser();
  rateLimit(`pw:${me.id}`, 10, 15 * 60 * 1000);
  const { currentPassword, newPassword } = passwordChangeSchema.parse(await req.json());
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw new ApiError(400, "Current password is incorrect.");
  if (currentPassword === newPassword) throw new ApiError(400, "Choose a password different from the current one.");
  await db.update(schema.users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(schema.users.id, me.id));
  return NextResponse.json({ ok: true });
});
