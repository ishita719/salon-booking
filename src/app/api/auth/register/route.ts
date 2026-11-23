import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { phoneDigits } from "@/lib/identity";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

// Client sign-up. Always creates a CLIENT account — staff join at /team/join with the owner's staff code.
export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const data = registerSchema.parse(await req.json());
  const db = getDb();

  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, data.email), columns: { id: true } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in.");

  const [user] = await db
    .insert(schema.users)
    .values({ name: data.name, email: data.email, phone: data.phone, phoneDigits: phoneDigits(data.phone), passwordHash: await hashPassword(data.password), role: "CUSTOMER" })
    .returning({ id: schema.users.id, role: schema.users.role });
  await startSession(user);
  return NextResponse.json({ ok: true, home: "/account" }, { status: 201 });
});
