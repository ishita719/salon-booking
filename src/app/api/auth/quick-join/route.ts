import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { maskEmail, NO_PASSWORD, phoneDigits, placeholderEmail, realEmail, sendVerificationCode } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { quickJoinSchema } from "@/lib/validation";

// Scan the salon QR → name + phone → you're in (no password).
// If that phone number already has an account we never just log in (anyone could type someone's number):
// we email a code instead, or the front desk shows a one-time login QR.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`quick-join:${ip}`, 12, 60 * 60 * 1000);
  const data = quickJoinSchema.parse(await req.json());
  const digits = phoneDigits(data.phone);
  if (digits.length < 10) throw new ApiError(400, "Enter your full phone number, including area code.");
  const db = getDb();
  const u = schema.users;

  const existing = await db.query.users.findFirst({ where: and(eq(u.phoneDigits, digits), eq(u.role, "CUSTOMER")) });
  if (existing) {
    if (!existing.active) throw new ApiError(403, "This account has been deactivated. Please contact the salon.");
    const email = realEmail(existing.email);
    if (!email) {
      throw new ApiError(409, "Welcome back! This number already has an account. Please ask at the front desk — they'll show you a one-time QR to log in.");
    }
    rateLimit(`quick-join-code:${email}`, 5, 60 * 60 * 1000);
    const { devCode } = await sendVerificationCode(db, email, "CLIENT_LOGIN");
    return NextResponse.json({ needsCode: true, email, maskedEmail: maskEmail(email), devCode });
  }

  const email = data.email || null;
  if (email && (await db.query.users.findFirst({ where: eq(u.email, email), columns: { id: true } }))) {
    throw new ApiError(409, "That email already has an account. Use “Email me a code” on the login page, or leave email empty.");
  }
  const [user] = await db
    .insert(u)
    .values({ name: data.name, phone: data.phone, phoneDigits: digits, email: email ?? placeholderEmail(), passwordHash: NO_PASSWORD, role: "CUSTOMER" })
    .returning({ id: u.id, role: u.role });
  await startSession(user, undefined, true); // stay signed in on this phone
  return NextResponse.json({ ok: true, home: "/account?welcome=1" }, { status: 201 });
});
