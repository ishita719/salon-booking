import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { checkVerificationCode } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { emailLoginSchema } from "@/lib/validation";

// Client logs in with the 6-digit code we emailed (no password needed). Stays signed in on this phone.
export const POST = route(async (req) => {
  const { email, code } = emailLoginSchema.parse(await req.json());
  rateLimit(`email-login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  const db = getDb();
  await checkVerificationCode(db, email, "CLIENT_LOGIN", code);
  const user = await db.query.users.findFirst({ where: and(eq(schema.users.email, email), eq(schema.users.role, "CUSTOMER")) });
  if (!user || !user.active) throw new ApiError(403, "This account can't log in. Please contact the salon.");
  await startSession(user, undefined, true);
  return NextResponse.json({ ok: true, home: "/account" });
});
