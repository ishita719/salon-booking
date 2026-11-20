import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { parseWorkDays } from "@/lib/bookings";
import { ACTIVE_STATUSES } from "@/lib/config";
import { hashPassword } from "@/lib/password";
import { salonNow } from "@/lib/time";
import { teamCreateSchema } from "@/lib/validation";

const { stylists, users, appointments } = schema;

// Owner only: list the team with their logins and workload.
export const GET = route(async () => {
  await requireOwner();
  const db = getDb();
  const today = salonNow().date;
  const [list, logins, upcoming] = await Promise.all([
    db.select().from(stylists).orderBy(desc(stylists.active), stylists.name),
    db.select({ id: users.id, email: users.email, phone: users.phone, active: users.active }).from(users).where(eq(users.role, "STAFF")),
    db
      .select({ stylistId: appointments.stylistId })
      .from(appointments)
      .where(and(gte(appointments.date, today), inArray(appointments.status, [...ACTIVE_STATUSES]))),
  ]);
  return NextResponse.json({
    team: list.map((s) => {
      const login = logins.find((u) => u.id === s.userId);
      return {
        id: s.id,
        name: s.name,
        title: s.title,
        bio: s.bio,
        active: s.active,
        workDays: parseWorkDays(s.workDays),
        email: login?.email ?? null,
        phone: login?.phone ?? null,
        hasLogin: !!login,
        upcoming: upcoming.filter((u) => u.stylistId === s.id).length,
      };
    }),
  });
});

// Owner only: add a team member directly (bookable profile + STAFF login with a temporary password).
export const POST = route(async (req) => {
  await requireOwner();
  const data = teamCreateSchema.parse(await req.json());
  const db = getDb();
  if (await db.query.users.findFirst({ where: eq(users.email, data.email), columns: { id: true } })) {
    throw new ApiError(409, "That email is already used by another account.");
  }
  const userId = crypto.randomUUID();
  const stylistId = crypto.randomUUID();
  await db.batch([
    db.insert(users).values({ id: userId, name: data.name, email: data.email, phone: data.phone, role: "STAFF", passwordHash: await hashPassword(data.password) }),
    db.insert(stylists).values({ id: stylistId, name: data.name, title: data.title, bio: data.bio, workDays: data.workDays, userId }),
  ]);
  return NextResponse.json({ id: stylistId }, { status: 201 });
});
