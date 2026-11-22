import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { requireOwner, requireUser, route } from "@/lib/api";
import { productSchema } from "@/lib/validation";

// Logged-in users see active products; the owner gets hidden ones too with ?all=1.
export const GET = route(async (req) => {
  const user = await requireUser();
  const all = user.role === "OWNER" && req.nextUrl.searchParams.get("all") === "1";
  const list = await getDb()
    .select()
    .from(schema.products)
    .where(all ? undefined : eq(schema.products.active, true))
    .orderBy(asc(schema.products.category), asc(schema.products.name));
  return NextResponse.json({ products: list });
});

export const POST = route(async (req) => {
  await requireOwner();
  const data = productSchema.parse(await req.json());
  const [p] = await getDb().insert(schema.products).values(data).returning();
  return NextResponse.json({ product: p }, { status: 201 });
});
