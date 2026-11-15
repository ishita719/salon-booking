import { NextResponse } from "next/server";
import { ApiError, requireOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { serviceSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = serviceSchema.partial().parse(await req.json());
  const found = await prisma.service.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new ApiError(404, "Service not found.");
  const service = await prisma.service.update({ where: { id }, data });
  return NextResponse.json({ service });
});

// Services that were ever booked are hidden (deactivated) rather than deleted, to keep history intact.
export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const found = await prisma.service.findUnique({ where: { id }, include: { _count: { select: { items: true } } } });
  if (!found) throw new ApiError(404, "Service not found.");
  if (found._count.items > 0) {
    await prisma.service.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, deactivated: true });
  }
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
});
