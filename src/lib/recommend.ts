// Personal recommendations for a client: from their saved skin check → services, products and offers.

import { eq } from "drizzle-orm";
import { DB, schema } from "@/db";
import { bestOffer, isFirstVisit, liveOffers, offerAppliesTo, offerLabel } from "./offers";
import { analyzeSkin, parseAnswers, rankItems, SkinAnalysis, TARGETS } from "./skin";
import { formatDuration, formatMoney } from "./time";

export async function getRecommendations(db: DB, userId: string) {
  const row = await db.query.skinProfiles.findFirst({ where: eq(schema.skinProfiles.userId, userId) });
  const answers = row ? parseAnswers(JSON.parse(row.answers)) : null;
  const analysis: SkinAnalysis | null = answers ? analyzeSkin(answers) : null;

  const [services, products, offers, firstVisit] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.active, true)),
    db.select().from(schema.products).where(eq(schema.products.active, true)),
    liveOffers(db),
    isFirstVisit(db, userId),
  ]);

  const recServices = analysis
    ? rankItems(services, analysis, 4).map(({ item: s, reasons, score }) => {
        const best = bestOffer(offers, [s], firstVisit);
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          description: s.description,
          durationLabel: formatDuration(s.durationMin),
          priceLabel: formatMoney(s.priceCents),
          offerPriceLabel: best ? formatMoney(s.priceCents - best.discountCents) : null,
          offerTitle: best?.offer.title ?? null,
          reasons,
          score,
        };
      })
    : [];

  let recProducts = analysis ? rankItems(products, analysis, 6) : [];
  // Sunscreen is part of every routine — make sure it's in the list.
  const spf = products.find((p) => p.targets.includes(analysis?.skinType ?? "~") && p.category.toLowerCase().includes("sun"));
  if (analysis && spf && !recProducts.some((r) => r.item.id === spf.id)) recProducts = [...recProducts.slice(0, 5), { item: spf, score: 1, reasons: ["Daily protection"] }];

  const recIds = new Set(recServices.map((s) => s.id));
  const relevantOffers = offers
    .filter((o) => !o.firstVisitOnly || firstVisit)
    .map((o) => {
      const forYou = services.filter((s) => recIds.has(s.id) && offerAppliesTo(o, s)).map((s) => s.name);
      return { id: o.id, title: o.title, description: o.description, label: offerLabel(o), endsOn: o.endsOn, forYou, firstVisitOnly: o.firstVisitOnly };
    })
    .sort((a, b) => b.forYou.length - a.forYou.length);

  return {
    hasProfile: !!analysis,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    answers,
    analysis: analysis && {
      ...analysis,
      concernLabels: analysis.concerns.map((c) => TARGETS[c]),
      hairConcernLabels: analysis.hairConcerns.map((c) => TARGETS[c]),
    },
    services: recServices,
    products: recProducts.map(({ item: p, reasons }) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description,
      howToUse: p.howToUse,
      priceLabel: formatMoney(p.priceCents),
      reasons,
    })),
    offers: relevantOffers,
    firstVisit,
  };
}

export type Recommendations = Awaited<ReturnType<typeof getRecommendations>>;
