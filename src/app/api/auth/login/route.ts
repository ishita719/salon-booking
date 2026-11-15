import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { homeFor, parseRole } from "@/lib/roles";
import { loginSchema } from "@/lib/validation";

// Used when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.5Pq0l9K4Xbq6c1N0jvQZ1Gq9yW7e";

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await req.json());
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${email}`, 8, 15 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Email or password is incorrect.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Please contact the salon owner.");

  await startSession(user);
  const role = parseRole(user.role);
  return NextResponse.json({ ok: true, role, home: homeFor(role) });
});
