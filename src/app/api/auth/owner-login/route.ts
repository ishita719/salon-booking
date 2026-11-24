import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { assertOwnerLoginOpen, clearOwnerLoginFailures, findOwnerByCode, recordOwnerLoginFailure } from "@/lib/identity";
import { rateLimit } from "@/lib/rate-limit";
import { ownerLoginSchema } from "@/lib/validation";

// OWNER login: the secret code only. Protected by per-device limits AND a database-wide lockout
// (10 wrong codes in 15 minutes → owner login closed for 15 minutes for everyone).
export const POST = route(async (req) => {
  rateLimit(`owner-login:${clientIp(req)}`, 8, 15 * 60 * 1000);
  const { code } = ownerLoginSchema.parse(await req.json());
  const db = getDb();
  await assertOwnerLoginOpen(db);
  const owner = await findOwnerByCode(db, code);
  if (!owner) {
    await recordOwnerLoginFailure(db);
    throw new ApiError(401, "That secret code isn't right.");
  }
  await clearOwnerLoginFailures(db);
  await startSession(owner);
  return NextResponse.json({ ok: true, role: "OWNER", home: "/owner" });
});
