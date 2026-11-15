import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { profileSchema } from "@/lib/validation";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const data = profileSchema.parse(await req.json());
  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, name: true, email: true, phone: true, role: true },
  });
  return NextResponse.json({ user: updated });
});
