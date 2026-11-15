import { NextResponse } from "next/server";
import { ApiError, requireTeam, route } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireTeam();
  const { id } = await params;
  const entry = await prisma.timeOff.findUnique({ where: { id } });
  if (!entry || (user.role === "STAFF" && entry.stylistId !== user.stylistId)) throw new ApiError(404, "Not found.");
  await prisma.timeOff.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
