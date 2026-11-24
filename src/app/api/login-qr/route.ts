import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, isTeam, requireUser, route } from "@/lib/api";
import { createLoginToken } from "@/lib/identity";
import { publicOrigin } from "@/lib/origin";
import { rateLimit } from "@/lib/rate-limit";

// Makes a one-time "scan to log in" QR (valid 10 minutes, works once).
//  • a client: for themselves, to sign in on another phone/tablet
//  • staff / owner: for a client standing at the front desk (clientId)
export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`login-qr:${user.id}:${clientIp(req)}`, 30, 60 * 60 * 1000);
  const { clientId } = z.object({ clientId: z.string().max(64).optional() }).parse(await req.json().catch(() => ({})));
  const db = getDb();

  let targetId = user.id;
  if (clientId && clientId !== user.id) {
    if (!isTeam(user)) throw new ApiError(403, "Not allowed.");
    const c = await db.query.users.findFirst({ where: and(eq(schema.users.id, clientId), eq(schema.users.role, "CUSTOMER")), columns: { id: true, active: true } });
    if (!c || !c.active) throw new ApiError(404, "Client not found.");
    targetId = c.id;
  } else if (user.role !== "CUSTOMER") {
    throw new ApiError(400, "Login QR codes are for client accounts.");
  }

  const { token, expiresAt } = await createLoginToken(db, targetId);
  return NextResponse.json({ url: `${await publicOrigin()}/q/${token}`, expiresAt: expiresAt.toISOString() });
});
