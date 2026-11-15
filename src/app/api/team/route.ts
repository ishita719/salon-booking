import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, requireOwner, route } from "@/lib/api";
import { parseWorkDays } from "@/lib/bookings";
import { ACTIVE_STATUSES } from "@/lib/config";
import { prisma } from "@/lib/db";
import { salonNow } from "@/lib/time";
import { teamCreateSchema } from "@/lib/validation";

// Owner only: list the team with their logins and workload.
export const GET = route(async () => {
  await requireOwner();
  const today = salonNow().date;
  const stylists = await prisma.stylist.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      user: { select: { email: true, phone: true, active: true } },
      _count: { select: { appointments: { where: { date: { gte: today }, status: { in: [...ACTIVE_STATUSES] } } } } },
    },
  });
  return NextResponse.json({
    team: stylists.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      bio: s.bio,
      active: s.active,
      workDays: parseWorkDays(s.workDays),
      email: s.user?.email ?? null,
      phone: s.user?.phone ?? null,
      hasLogin: !!s.user,
      upcoming: s._count.appointments,
    })),
  });
});

// Owner only: add a team member = bookable stylist profile + STAFF login.
export const POST = route(async (req) => {
  await requireOwner();
  const data = teamCreateSchema.parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })) {
    throw new ApiError(409, "That email is already used by another account.");
  }
  const stylist = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: data.name, email: data.email, phone: data.phone, role: "STAFF", passwordHash: await bcrypt.hash(data.password, 12) },
    });
    return tx.stylist.create({ data: { name: data.name, title: data.title, bio: data.bio, workDays: data.workDays, userId: user.id } });
  });
  return NextResponse.json({ id: stylist.id }, { status: 201 });
});
