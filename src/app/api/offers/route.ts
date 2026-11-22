import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, requireOwner, requireUser, route } from "@/lib/api";
import { isFirstVisit, liveOffers, serializeOffer } from "@/lib/offers";
import { offerSchema } from "@/lib/validation";

// Offers are for logged-in members: clients see live offers they qualify for; the owner sees all of them.
export const GET = route(async () => {
  const user = await requireUser();
  const db = getDb();
  const services = await db.select({ id: schema.services.id, name: schema.services.name, category: schema.services.category }).from(schema.services).where(eq(schema.services.active, true));
  if (user.role === "OWNER") {
    const all = await db.select().from(schema.offers).orderBy(desc(schema.offers.createdAt));
    return NextResponse.json({ offers: all.map((o) => serializeOffer(o, services)) });
  }
  const first = user.role === "CUSTOMER" ? await isFirstVisit(db, user.id) : false;
  const live = (await liveOffers(db)).filter((o) => !o.firstVisitOnly || first);
  return NextResponse.json({ offers: live.map((o) => serializeOffer(o, services)), firstVisit: first });
});

export const POST = route(async (req) => {
  await requireOwner();
  const data = offerSchema.parse(await req.json());
  if (!data.serviceIds && !data.categories && data.discountType === "AMOUNT" && data.value > 50_000) throw new ApiError(400, "That discount looks too large.");
  const [o] = await getDb().insert(schema.offers).values(data).returning({ id: schema.offers.id });
  return NextResponse.json({ id: o.id }, { status: 201 });
});
