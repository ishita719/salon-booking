import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, clientIp, requireUser, route } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { getRecommendations } from "@/lib/recommend";
import { analyzeSkin, parseAnswers } from "@/lib/skin";

// Client: their saved skin profile + personalised services, products and offers.
export const GET = route(async () => {
  const user = await requireUser();
  if (user.role !== "CUSTOMER") throw new ApiError(403, "The skin check is for clients.");
  return NextResponse.json(await getRecommendations(getDb(), user.id));
});

// Client: submit (or retake) the skin & hair check.
export const POST = route(async (req) => {
  const user = await requireUser();
  if (user.role !== "CUSTOMER") throw new ApiError(403, "The skin check is for clients.");
  rateLimit(`skin:${user.id}:${clientIp(req)}`, 20, 60 * 60 * 1000);
  const body = (await req.json()) as { answers?: unknown } | null;
  const answers = parseAnswers(body?.answers);
  if (!answers) throw new ApiError(400, "Please answer every question (choose at least one skin concern).");
  const a = analyzeSkin(answers);
  const values = {
    answers: JSON.stringify(answers),
    skinType: a.skinType,
    sensitivity: a.sensitivity,
    concerns: a.concerns.join(","),
    hairType: a.hairType,
    hairConcerns: a.hairConcerns.join(","),
    updatedAt: new Date(),
  };
  const db = getDb();
  await db
    .insert(schema.skinProfiles)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: schema.skinProfiles.userId, set: values });
  return NextResponse.json(await getRecommendations(db, user.id));
});
