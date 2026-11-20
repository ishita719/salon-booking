import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { codesMatch, hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { ownerSetupSchema } from "@/lib/validation";

async function ownerExists() {
  return !!(await getDb().query.users.findFirst({ where: eq(schema.users.role, "OWNER"), columns: { id: true } }));
}

// Is first-time setup still needed? (Used by the /team page to show the setup link.)
export const GET = route(async () => {
  return NextResponse.json({ needed: !(await ownerExists()) });
});

// One-time owner account creation. Works ONLY while there is no owner yet, and only with SETUP_CODE
// (a secret you set in Cloudflare). After that, this endpoint is permanently closed.
export const POST = route(async (req) => {
  rateLimit(`owner-setup:${clientIp(req)}`, 5, 60 * 60 * 1000);
  const data = ownerSetupSchema.parse(await req.json());
  if (await ownerExists()) throw new ApiError(403, "The owner account already exists. Please log in.");
  const expected = getEnv("SETUP_CODE");
  if (!expected || expected.length < 8) throw new ApiError(403, "Setup is not enabled: the SETUP_CODE secret is not set.");
  if (!(await codesMatch(data.setupCode, expected))) throw new ApiError(403, "The setup code is incorrect.");

  const db = getDb();
  if (await db.query.users.findFirst({ where: eq(schema.users.email, data.email), columns: { id: true } })) {
    throw new ApiError(409, "That email is already used by another account.");
  }
  const [user] = await db
    .insert(schema.users)
    .values({ name: data.name, email: data.email, phone: data.phone, passwordHash: await hashPassword(data.password), role: "OWNER" })
    .returning({ id: schema.users.id, role: schema.users.role });
  await startSession(user);
  return NextResponse.json({ ok: true, home: "/owner" }, { status: 201 });
});
