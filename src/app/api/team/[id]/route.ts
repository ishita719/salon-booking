import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { phoneDigits } from "@/lib/identity";
import { hashPassword } from "@/lib/password";
import { teamUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const { stylists, users } = schema;

// Owner only: edit a team member, change work days, deactivate (blocks login + booking), or reset password.
// Team members are never hard-deleted so past appointments keep their history.
export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = teamUpdateSchema.parse(await req.json());
  const db = getDb();
  const stylist = await db.query.stylists.findFirst({ where: eq(stylists.id, id) });
  if (!stylist) throw new ApiError(404, "Team member not found.");

  const stylistSet = Object.fromEntries(
    Object.entries({ name: data.name, title: data.title, bio: data.bio, workDays: data.workDays, active: data.active }).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(stylistSet).length) await db.update(stylists).set(stylistSet).where(eq(stylists.id, id));

  if (stylist.userId) {
    const userSet: Partial<typeof users.$inferInsert> = {};
    if (data.name !== undefined) userSet.name = data.name;
    if (data.phone !== undefined) {
      userSet.phone = data.phone;
      userSet.phoneDigits = phoneDigits(data.phone);
    }
    if (data.active !== undefined) userSet.active = data.active;
    if (data.newPassword) userSet.passwordHash = await hashPassword(data.newPassword);
    if (Object.keys(userSet).length) await db.update(users).set(userSet).where(eq(users.id, stylist.userId));
  }
  return NextResponse.json({ ok: true });
});
