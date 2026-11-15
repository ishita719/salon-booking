import { NextResponse } from "next/server";
import { requireOwner, route } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serviceSchema } from "@/lib/validation";

// Public: active services. The owner gets hidden ones too with ?all=1.
export const GET = route(async (req) => {
  const wantAll = req.nextUrl.searchParams.get("all") === "1";
  const isOwner = wantAll && (await getSessionUser())?.role === "OWNER";
  const services = await prisma.service.findMany({
    where: isOwner ? {} : { active: true },
    orderBy: [{ category: "asc" }, { priceCents: "asc" }],
  });
  return NextResponse.json({ services });
});

export const POST = route(async (req) => {
  await requireOwner();
  const data = serviceSchema.parse(await req.json());
  const service = await prisma.service.create({ data });
  return NextResponse.json({ service }, { status: 201 });
});
