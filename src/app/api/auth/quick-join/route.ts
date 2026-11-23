import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { NO_PASSWORD, phoneDigits, placeholderEmail } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { quickJoinSchema } from "@/lib/validation";

// Clients sign in ONLY with QR codes:
//  • New client: scan the salon QR → name + phone → signed in on this phone (no password).
//  • Returning client on a new phone: typing a number that already has an account never logs anyone in
//    (anyone could type someone's number) — they scan a one-time login QR from the front desk or their other phone.
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
    throw new ApiError(
      409,
      "Welcome back! This number already has an account. To log in on this phone, scan your login QR: ask at the front desk, or open Settings → “Show my login QR” on your other phone.",
    );
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
