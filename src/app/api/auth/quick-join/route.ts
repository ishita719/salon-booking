import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { SALON } from "@/lib/config";
import { sendEmail } from "@/lib/email";
import { NO_PASSWORD, phoneDigits, placeholderEmail, realEmail } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { quickJoinSchema } from "@/lib/validation";

/** First name, compared without case, accents or extra spaces ("  émma " = "Emma"). */
function firstName(name: string, display = false): string {
  const f = name.trim().split(/\s+/)[0] ?? "";
  return display ? f : f.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Client sign-in with name + phone (what the salon QR opens; also the fallback when scanning doesn't work):
//  • New number  → account created, signed in on this phone (no password).
//  • Known number → signed in if the FIRST NAME matches the account. Wrong tries are limited, and the client
//    gets an email (if they gave one) when a new phone signs in. A one-time login QR is the safer option.
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
    rateLimit(`client-login:${digits}`, 5, 60 * 60 * 1000); // slows down guessing names for a number
    rateLimit(`client-login-ip:${ip}`, 10, 60 * 60 * 1000);
    if (firstName(existing.name) !== firstName(data.name)) {
      throw new ApiError(401, "That name doesn't match the account for this phone number. Use the first name you signed up with, or ask the front desk for your login QR.");
    }
    await startSession(existing, undefined, true);
    const email = realEmail(existing.email);
    if (email) {
      await sendEmail(
        email,
        `New sign-in to your ${SALON.name} account`,
        `Hi ${firstName(existing.name, true)},\n\nYour account was just opened on a new phone using your name and number.\nIf this wasn't you, please call us at ${SALON.phone}.`,
      );
    }
    return NextResponse.json({ ok: true, home: "/account?welcome=1", returning: true });
  }

  const email = data.email || null;
  if (email && (await db.query.users.findFirst({ where: eq(u.email, email), columns: { id: true } }))) {
    throw new ApiError(409, "That email is already used by another account — leave it empty or use a different one.");
  }
  const [user] = await db
    .insert(u)
    .values({ name: data.name, phone: data.phone, phoneDigits: digits, email: email ?? placeholderEmail(), passwordHash: NO_PASSWORD, role: "CUSTOMER" })
    .returning({ id: u.id, role: u.role });
  await startSession(user, undefined, true); // stay signed in on this phone
  return NextResponse.json({ ok: true, home: "/account?welcome=1" }, { status: 201 });
});
