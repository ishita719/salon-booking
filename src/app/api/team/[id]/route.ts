import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, requireOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { teamUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

// Owner only: edit a team member, change work days, deactivate (blocks login + booking), or reset password.
// Team members are never hard-deleted so past appointments keep their history.
export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = teamUpdateSchema.parse(await req.json());
  const stylist = await prisma.stylist.findUnique({ where: { id } });
  if (!stylist) throw new ApiError(404, "Team member not found.");

  await prisma.$transaction(async (tx) => {
    await tx.stylist.update({
      where: { id },
      data: { name: data.name, title: data.title, bio: data.bio, workDays: data.workDays, active: data.active },
    });
    if (stylist.userId) {
      await tx.user.update({
        where: { id: stylist.userId },
        data: {
          name: data.name,
          phone: data.phone,
          active: data.active,
          passwordHash: data.newPassword ? await bcrypt.hash(data.newPassword, 12) : undefined,
        },
      });
    }
  });
  return NextResponse.json({ ok: true });
});
