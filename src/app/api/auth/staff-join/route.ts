import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, route } from "@/lib/api";
import { startSession } from "@/lib/auth";
import { phoneDigits } from "@/lib/identity";
import { codesMatch, hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { getStaffCode } from "@/lib/settings";
import { staffJoinSchema } from "@/lib/validation";

// Staff sign-up (/team/join): only possible with the staff code the owner set and shared.
export const POST = route(async (req) => {
  rateLimit(`staff-join:${clientIp(req)}`, 6, 60 * 60 * 1000); // slows down code guessing
  const data = staffJoinSchema.parse(await req.json());

  const current = await getStaffCode();
  if (!current) throw new ApiError(403, "The owner hasn't set a staff code yet. Please ask the owner.");
  if (!(await codesMatch(data.staffCode, current))) throw new ApiError(403, "The staff code is incorrect. Ask the owner for the current code.");

  const db = getDb();
  const exists = await db.query.users.findFirst({ where: eq(schema.users.email, data.email), columns: { id: true } });
  if (exists) throw new ApiError(409, "An account with this email already exists. Try logging in.");

  const [user] = await db
    .insert(schema.users)
    .values({ name: data.name, email: data.email, phone: data.phone, phoneDigits: phoneDigits(data.phone), passwordHash: await hashPassword(data.password), role: "STAFF" })
    .returning({ id: schema.users.id, role: schema.users.role });
  // Bookable profile; the owner can change title and working days on the Team page.
  await db.insert(schema.stylists).values({ name: data.name, title: "Stylist", workDays: "2,3,4,5,6", userId: user.id });

  await startSession(user, current);
  return NextResponse.json({ ok: true, home: "/staff" }, { status: 201 });
});
