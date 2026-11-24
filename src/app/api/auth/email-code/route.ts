import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { sendVerificationCode } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { getOwnerInvites } from "@/lib/settings";
import { emailCodeRequestSchema } from "@/lib/validation";

// Sends a 6-digit code by email — OWNERS only (clients sign in with QR codes). For "forgot owner code" we always
// answer the same way, so nobody can use this to find out which emails have accounts.
export const POST = route(async (req) => {
  const { email, purpose } = emailCodeRequestSchema.parse(await req.json());
  rateLimit(`email-code:${clientIp(req)}`, 10, 60 * 60 * 1000);
  rateLimit(`email-code:${email}`, 5, 60 * 60 * 1000);
  const db = getDb();
  const u = schema.users;
  const generic = NextResponse.json({ ok: true, message: "If an account exists for that email, we've sent a 6-digit code. It expires in 10 minutes." });

  if (purpose === "OWNER_RESET") {
    const user = await db.query.users.findFirst({ where: and(eq(u.email, email), eq(u.role, "OWNER"), eq(u.active, true)) });
    if (!user) return generic;
    const { devCode } = await sendVerificationCode(db, email, purpose);
    return devCode ? NextResponse.json({ ok: true, message: "Code sent.", devCode }) : generic;
  }

  // OWNER_SIGNUP: allowed for the very first owner, or for an email an existing owner has invited.
  if (await db.query.users.findFirst({ where: eq(u.email, email), columns: { id: true } })) {
    throw new ApiError(409, "That email already has an account. Log in instead (or use “Forgot secret code”).");
  }
  const ownerExists = !!(await db.query.users.findFirst({ where: eq(u.role, "OWNER"), columns: { id: true } }));
  if (ownerExists && !(await getOwnerInvites()).includes(email)) {
    throw new ApiError(403, "To add another owner, an existing owner must first invite this email (Owner → Team → Co-owners).");
  }
  const { devCode } = await sendVerificationCode(db, email, purpose);
  return NextResponse.json({ ok: true, message: "We've emailed you a 6-digit code.", devCode });
});
