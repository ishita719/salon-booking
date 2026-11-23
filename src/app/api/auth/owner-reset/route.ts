import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { checkVerificationCode } from "@/lib/identity";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ownerResetSchema } from "@/lib/validation";

// Owner forgot their owner code (or password): prove the email with a 6-digit code, then set new ones.
export const POST = route(async (req) => {
  rateLimit(`owner-reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const data = ownerResetSchema.parse(await req.json());
  const db = getDb();
  await checkVerificationCode(db, data.email, "OWNER_RESET", data.code);
  const user = await db.query.users.findFirst({ where: and(eq(schema.users.email, data.email), eq(schema.users.role, "OWNER")) });
  if (!user || !user.active) throw new ApiError(403, "This account can't be reset. Contact another owner.");
  await db
    .update(schema.users)
    .set({ pinHash: await hashPassword(data.newOwnerCode), ...(data.newPassword ? { passwordHash: await hashPassword(data.newPassword) } : {}) })
    .where(eq(schema.users.id, user.id));
  await startSession(user);
  return NextResponse.json({ ok: true, home: "/owner" });
});
