import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, route } from "@/lib/api";
import { feedbackUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const { feedback } = schema;

// Owner only: show/hide a review on the home page, or reply to it.
export const PATCH = route<Ctx>(async (req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const data = feedbackUpdateSchema.parse(await req.json());
  const set: Partial<typeof feedback.$inferInsert> = {};
  if (data.isPublic !== undefined) set.isPublic = data.isPublic;
  if (data.ownerReply !== undefined) set.ownerReply = data.ownerReply || null;
  if (!Object.keys(set).length) throw new ApiError(400, "Nothing to change.");
  const [row] = await getDb().update(feedback).set(set).where(eq(feedback.id, id)).returning({ id: feedback.id });
  if (!row) throw new ApiError(404, "Feedback not found.");
  return NextResponse.json({ ok: true });
});

// Owner only: remove a review (e.g. spam or abusive language).
export const DELETE = route<Ctx>(async (_req, { params }) => {
  await requireOwner();
  const { id } = await params;
  const [row] = await getDb().delete(feedback).where(eq(feedback.id, id)).returning({ id: feedback.id });
  if (!row) throw new ApiError(404, "Feedback not found.");
  return NextResponse.json({ ok: true });
});
