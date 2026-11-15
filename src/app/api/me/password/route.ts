import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ApiError, requireUser, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { passwordChangeSchema } from "@/lib/validation";

export const PATCH = route(async (req) => {
  const me = await requireUser();
  rateLimit(`pw:${me.id}`, 10, 15 * 60 * 1000);
  const { currentPassword, newPassword } = passwordChangeSchema.parse(await req.json());
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new ApiError(400, "Current password is incorrect.");
  if (currentPassword === newPassword) throw new ApiError(400, "Choose a password different from the current one.");
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
  return NextResponse.json({ ok: true });
});
