import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

/** Constant-time comparison so the owner code can't be guessed by measuring response times. */
function codeMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Sign-up. The chosen role is only a REQUEST — the server decides what is allowed:
//  CUSTOMER → active immediately
//  STAFF    → created inactive, waits for the owner to approve it on the Team page
//  OWNER    → only with the secret OWNER_INVITE_CODE (set in Vercel); otherwise refused
export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`register:${ip}`, 10, 60 * 60 * 1000);
  const data = registerSchema.parse(await req.json());

  if (data.role === "OWNER") {
    rateLimit(`owner-code:${ip}`, 5, 60 * 60 * 1000); // slow down code guessing
    const expected = process.env.OWNER_INVITE_CODE;
    if (!expected || expected.length < 12) throw new ApiError(403, "Owner sign-up is turned off. Please contact the salon owner.");
    if (!data.ownerCode || !codeMatches(data.ownerCode, expected)) throw new ApiError(403, "The owner access code is not correct.");
  }

  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in.");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: data.role,
      active: data.role !== "STAFF", // staff must be approved first
    },
    select: { id: true, role: true, name: true },
  });

  if (data.role === "STAFF") {
    return NextResponse.json(
      { ok: true, pending: true, message: "Thanks! Your staff account has been requested. You can log in once the salon owner approves it." },
      { status: 201 },
    );
  }

  await startSession(user);
  return NextResponse.json(
    { ok: true, name: user.name, role: data.role, home: data.role === "OWNER" ? "/owner" : "/account" },
    { status: 201 },
  );
});
