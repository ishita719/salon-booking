import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

// CLIENT login (/login). The owner and staff use the separate team login (/team).
export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await req.json());
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${email}`, 8, 15 * 60 * 1000);

  const user = await getDb().query.users.findFirst({ where: eq(schema.users.email, email) });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Email or password is incorrect.");
  if (user.role !== "CUSTOMER") throw new ApiError(403, "This is the client login. Salon owner and staff: please use the Team login.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Please contact the salon.");

  await startSession(user);
  return NextResponse.json({ ok: true, home: "/account" });
});
