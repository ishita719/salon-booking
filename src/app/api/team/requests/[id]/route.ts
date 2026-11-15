import { NextResponse } from "next/server";
import { ApiError, requireOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { staffRequestSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Owner only: approve (activates the login + creates their bookable profile) or reject (removes the request).
export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const body = staffRequestSchema.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { id }, include: { stylist: true, _count: { select: { appointments: true } } } });
  if (!user || user.role !== "STAFF" || user.active || user.stylist) throw new ApiError(404, "Request not found.");

  if (body.action === "reject") {
    if (user._count.appointments > 0) throw new ApiError(400, "This account has bookings and can't be removed.");
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true, rejected: true });
  }

  await prisma.$transaction([
    prisma.stylist.create({
      data: { name: user.name, title: body.title ?? "Stylist", workDays: body.workDays ?? "2,3,4,5,6", userId: user.id },
    }),
    prisma.user.update({ where: { id }, data: { active: true } }),
  ]);
  return NextResponse.json({ ok: true, approved: true });
});
