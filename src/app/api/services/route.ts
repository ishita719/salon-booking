import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { requireOwner, route } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { serviceSchema } from "@/lib/validation";

const { services } = schema;

// Public: active services. The owner gets hidden ones too with ?all=1.
export const GET = route(async (req) => {
  const wantAll = req.nextUrl.searchParams.get("all") === "1";
  const isOwner = wantAll && (await getSessionUser())?.role === "OWNER";
  const list = await getDb()
    .select()
    .from(services)
    .where(isOwner ? undefined : eq(services.active, true))
    .orderBy(asc(services.category), asc(services.priceCents));
  return NextResponse.json({ services: list });
});

export const POST = route(async (req) => {
  await requireOwner();
  const data = serviceSchema.parse(await req.json());
  const [service] = await getDb().insert(services).values(data).returning();
  return NextResponse.json({ service }, { status: 201 });
});
