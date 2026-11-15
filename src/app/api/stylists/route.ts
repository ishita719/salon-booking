import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  const stylists = await prisma.stylist.findMany({
    where: { active: true },
    select: { id: true, name: true, title: true, bio: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ stylists });
});
