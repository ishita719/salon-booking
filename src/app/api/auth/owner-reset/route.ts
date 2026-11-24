import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { checkVerificationCode, clearOwnerLoginFailures, ownerCodeInUse } from "@/lib/identity";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ownerResetSchema } from "@/lib/validation";

// Owner forgot their secret code: prove the email with a 6-digit code, then set a new secret code.
export const POST = route(async (req) => {
  rateLimit(`owner-reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const data = ownerResetSchema.parse(await req.json());
  const db = getDb();
  await checkVerificationCode(db, data.email, "OWNER_RESET", data.code);
  const user = await db.query.users.findFirst({ where: and(eq(schema.users.email, data.email), eq(schema.users.role, "OWNER")) });
  if (!user || !user.active) throw new ApiError(403, "This account can't be reset. Contact another owner.");
  if (await ownerCodeInUse(db, data.newOwnerCode, user.id)) throw new ApiError(409, "That secret code can't be used — please choose a different one.");
  await db.update(schema.users).set({ pinHash: await hashPassword(data.newOwnerCode) }).where(eq(schema.users.id, user.id));
  await clearOwnerLoginFailures(db);
  await startSession(user);
  return NextResponse.json({ ok: true, home: "/owner" });
});
