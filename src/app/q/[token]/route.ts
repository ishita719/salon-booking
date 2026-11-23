import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { startSession } from "@/lib/auth";
import { consumeLoginToken } from "@/lib/identity";

type Ctx = { params: Promise<{ token: string }> };

// A client scans their one-time login QR (shown by the front desk, or from their other device) → signed in.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const db = getDb();
  const userId = await consumeLoginToken(db, token);
  const user = userId ? await db.query.users.findFirst({ where: eq(schema.users.id, userId) }) : null;
  if (!user || !user.active || user.role !== "CUSTOMER") {
    return NextResponse.redirect(new URL("/welcome?expired=1", req.url));
  }
  await startSession(user, undefined, true);
  return NextResponse.redirect(new URL("/account?welcome=1", req.url));
}
