import { NextResponse } from "next/server";
import { requireOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";

// Owner only: staff who signed up themselves and are waiting for approval
// (role STAFF, inactive, not yet linked to a stylist profile).
export const GET = route(async () => {
  await requireOwner();
  const pending = await prisma.user.findMany({
    where: { role: "STAFF", active: false, stylist: null },
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ requests: pending.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })) });
});
