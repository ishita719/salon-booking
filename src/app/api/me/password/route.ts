import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireUser, route } from "@/lib/api";
import { hasPassword } from "@/lib/identity";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const me = await requireUser();
  rateLimit(`pw:${me.id}`, 10, 15 * 60 * 1000);
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, me.id) });
  if (!user) throw new ApiError(401, "Please log in first.");
  // Accounts made by scanning the salon QR have no password yet — they can just set one.
  const body = (await req.json()) as { newPassword?: unknown } | null;
  const { currentPassword, newPassword } = hasPassword(user.passwordHash)
    ? passwordChangeSchema.parse(body)
    : { currentPassword: "", newPassword: passwordChangeSchema.shape.newPassword.parse(body?.newPassword) };
  if (hasPassword(user.passwordHash) && !(await verifyPassword(currentPassword, user.passwordHash))) throw new ApiError(400, "Current password is incorrect.");
  if (currentPassword === newPassword) throw new ApiError(400, "Choose a password different from the current one.");
  await db.update(schema.users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(schema.users.id, me.id));
  return NextResponse.json({ ok: true });
});
