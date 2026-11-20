import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { codesMatch, DUMMY_HASH, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { homeFor, parseRole } from "@/lib/roles";
import { getStaffCode } from "@/lib/settings";
import { teamLoginSchema } from "@/lib/validation";

// TEAM login (/team): the owner logs in with email + password; staff ALSO need the current staff code every time.
export const POST = route(async (req) => {
  const data = teamLoginSchema.parse(await req.json());
  const ip = clientIp(req);
  rateLimit(`team-login:${ip}`, 15, 15 * 60 * 1000);
  rateLimit(`team-login:${data.email}`, 8, 15 * 60 * 1000);

  const user = await getDb().query.users.findFirst({ where: eq(schema.users.email, data.email) });
  const ok = await verifyPassword(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "Email or password is incorrect.");

  const role = parseRole(user.role);
  if (role === "CUSTOMER") throw new ApiError(403, "This is the salon team login. Clients: please use the client login.");
  if (role !== data.as) throw new ApiError(403, `This is ${role === "OWNER" ? "the owner" : "a staff"} account — choose "${role === "OWNER" ? "Owner" : "Staff"}" above.`);
  if (!user.active) throw new ApiError(403, "This account has been deactivated. Please contact the salon owner.");

  let staffCode: string | undefined;
  if (role === "STAFF") {
    const current = await getStaffCode();
    if (!current) throw new ApiError(403, "The owner hasn't set a staff code yet. Please ask the owner.");
    if (!data.staffCode || !(await codesMatch(data.staffCode, current))) {
      throw new ApiError(403, "The staff code is incorrect. Ask the owner for the current code.");
    }
    staffCode = current;
  }

  await startSession(user, staffCode);
  return NextResponse.json({ ok: true, role, home: homeFor(role) });
});
