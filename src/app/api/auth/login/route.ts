import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { homeFor, parseRole, ROLE_LABEL } from "@/lib/roles";
import { loginSchema } from "@/lib/validation";

// Used when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.5Pq0l9K4Xbq6c1N0jvQZ1Gq9yW7e";

export const POST = route(async (req) => {
  const { email, password, role: chosen } = loginSchema.parse(await req.json());
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${email}`, 8, 15 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { email }, include: { stylist: { select: { id: true } } } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Email or password is incorrect.");
  if (!user.active) {
    const pending = user.role === "STAFF" && !user.stylist;
    throw new ApiError(
      403,
      pending
        ? "Your staff account is waiting for the salon owner's approval. You'll be able to log in once it's approved."
        : "This account has been deactivated. Please contact the salon owner.",
    );
  }

  // The "I am a" dropdown must match the account's real role (decided by the database, never the form).
  const role = parseRole(user.role);
  if (chosen && chosen !== role) {
    throw new ApiError(403, `This is not ${chosen === "OWNER" ? "an" : "a"} ${ROLE_LABEL[chosen].toLowerCase()} account. Choose "${ROLE_LABEL[role]}" in the "I am a" list and try again.`);
  }

  await startSession(user);
  return NextResponse.json({ ok: true, role, home: homeFor(role) });
});
