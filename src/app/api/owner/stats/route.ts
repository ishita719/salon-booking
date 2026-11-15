import { NextResponse } from "next/server";
import { requireOwner, route } from "@/lib/api";
import { getOwnerStats } from "@/lib/stats";

export const GET = route(async () => {
  await requireOwner();
  return NextResponse.json(await getOwnerStats());
});
