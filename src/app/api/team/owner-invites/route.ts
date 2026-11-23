import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { getOwnerInvites, setOwnerInvites } from "@/lib/settings";
import { ownerInviteSchema } from "@/lib/validation";

// Owner only: invite a co-owner by email. They then create their account at /team/setup with that email.
export const GET = route(async () => {
  await requireOwner();
  const owners = await getDb().select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.role, "OWNER"));
  return NextResponse.json({ invites: await getOwnerInvites(), owners });
});

export const POST = route(async (req) => {
  await requireOwner();
  const { email } = ownerInviteSchema.parse(await req.json());
  if (await getDb().query.users.findFirst({ where: eq(schema.users.email, email), columns: { id: true } })) {
    throw new ApiError(409, "That email already has an account on the website.");
  }
  await setOwnerInvites([...(await getOwnerInvites()), email]);
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (req) => {
  await requireOwner();
  const { email } = ownerInviteSchema.parse(await req.json());
  await setOwnerInvites((await getOwnerInvites()).filter((e) => e !== email));
  return NextResponse.json({ ok: true });
});
