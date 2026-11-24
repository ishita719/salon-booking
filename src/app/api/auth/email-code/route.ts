import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { clientIp, route } from "@/lib/api";
import { sendVerificationCode } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { emailCodeRequestSchema } from "@/lib/validation";

// "Forgot secret code": emails an owner a 6-digit code. Always answers the same way, so nobody can use this
// to find out which emails have accounts.
export const POST = route(async (req) => {
  const { email } = emailCodeRequestSchema.parse(await req.json());
  rateLimit(`email-code:${clientIp(req)}`, 10, 60 * 60 * 1000);
  rateLimit(`email-code:${email}`, 5, 60 * 60 * 1000);
  const db = getDb();
  const u = schema.users;
  const generic = NextResponse.json({ ok: true, message: "If an account exists for that email, we've sent a 6-digit code. It expires in 10 minutes." });

  const user = await db.query.users.findFirst({ where: and(eq(u.email, email), eq(u.role, "OWNER"), eq(u.active, true)) });
  if (!user) return generic;
  const { devCode } = await sendVerificationCode(db, email, "OWNER_RESET");
  return devCode ? NextResponse.json({ ok: true, message: "Code sent.", devCode }) : generic;
});
