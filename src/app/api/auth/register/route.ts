import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const data = registerSchema.parse(await req.json());

  const exists = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in.");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: "CUSTOMER", // never trust a role sent by the client
    },
    select: { id: true, role: true, name: true },
  });
  await startSession(user);
  return NextResponse.json({ ok: true, name: user.name, role: "CUSTOMER", home: "/account" }, { status: 201 });
});
