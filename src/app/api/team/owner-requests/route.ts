import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { getPendingOwnerIds, setPendingOwnerIds } from "@/lib/settings";

const u = schema.users;

// Owner only: the current owners and the owner accounts waiting for approval.
export const GET = route(async () => {
  await requireOwner();
  const db = getDb();
  const ids = await getPendingOwnerIds();
  const owners = await db.select({ name: u.name, email: u.email }).from(u).where(and(eq(u.role, "OWNER"), eq(u.active, true)));
  const pending = ids.length
    ? await db.select({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }).from(u).where(and(inArray(u.id, ids), eq(u.role, "OWNER"), eq(u.active, false)))
    : [];
  return NextResponse.json({ owners, pending });
});

// Owner only: approve (the account becomes a full owner) or decline (the account is deleted).
export const POST = route(async (req) => {
  await requireOwner();
  const { id, action } = z.object({ id: z.string().min(1).max(64), action: z.enum(["approve", "decline"]) }).parse(await req.json());
  const db = getDb();
  const ids = await getPendingOwnerIds();
  if (!ids.includes(id)) throw new ApiError(404, "That request was already handled.");
  const where = and(eq(u.id, id), eq(u.role, "OWNER"), eq(u.active, false));
  if (action === "approve") await db.update(u).set({ active: true }).where(where);
  else await db.delete(u).where(where);
  await setPendingOwnerIds(ids.filter((x) => x !== id));
  return NextResponse.json({ ok: true });
});
