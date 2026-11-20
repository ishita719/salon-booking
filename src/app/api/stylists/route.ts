import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { route } from "@/lib/api";

const { stylists } = schema;

export const GET = route(async () => {
  const list = await getDb()
    .select({ id: stylists.id, name: stylists.name, title: stylists.title, bio: stylists.bio })
    .from(stylists)
    .where(eq(stylists.active, true))
    .orderBy(asc(stylists.name));
  return NextResponse.json({ stylists: list });
});
