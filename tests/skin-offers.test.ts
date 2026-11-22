import assert from "node:assert/strict";
import { test } from "node:test";
import { bestOffer, discountFor, OfferLike } from "../src/lib/offer-math";
import { analyzeSkin, parseAnswers, rankItems } from "../src/lib/skin";

const oilyAcne = {
  skinFeel: "oily",
  pores: "large",
  reactivity: "rarely",
  concerns: ["acne"],
  age: "under25",
  sun: "daily",
  hairType: "straight",
  hairConcerns: [],
  goal: "fix",
};

test("rejects incomplete or invalid answers", () => {
  assert.equal(parseAnswers({ ...oilyAcne, skinFeel: "greasy" }), null);
  assert.equal(parseAnswers({ ...oilyAcne, concerns: [] }), null);
  assert.ok(parseAnswers(oilyAcne));
});

test("oily, breakout-prone skin gets pores + acne focus and a clarifying routine", () => {
  const a = analyzeSkin(parseAnswers(oilyAcne)!);
  assert.equal(a.skinType, "oily");
  assert.ok(a.concerns.includes("acne") && a.concerns.includes("pores"));
  assert.match(a.routine.am[0], /gel cleanser/);
});

test("matching ranks the clarifying facial above the hydrating one for oily skin", () => {
  const a = analyzeSkin(parseAnswers(oilyAcne)!);
  const ranked = rankItems(
    [
      { id: "hydra", targets: "dry,normal,dehydration,dullness" },
      { id: "clarify", targets: "oily,combination,acne,pores" },
    ],
    a,
    5,
  );
  assert.equal(ranked[0].item.id, "clarify");
  assert.ok(!ranked.some((r) => r.item.id === "hydra"));
});

test("strong treatments are never suggested for very sensitive skin", () => {
  const a = analyzeSkin(parseAnswers({ ...oilyAcne, reactivity: "often", concerns: ["pigmentation"] })!);
  const ranked = rankItems([{ id: "peel", targets: "pigmentation,oily,strong" }, { id: "calm", targets: "sensitive,redness" }], a, 5);
  assert.deepEqual(ranked.map((r) => r.item.id), ["calm"]);
});

const offer = (o: Partial<OfferLike>): OfferLike => ({ id: "o", title: "t", discountType: "PERCENT", value: 20, serviceIds: "", categories: "", firstVisitOnly: false, startsOn: null, endsOn: null, active: true, ...o });

test("offers: category discount only applies to that category", () => {
  const services = [
    { id: "a", category: "Skin", priceCents: 10000 },
    { id: "b", category: "Hair", priceCents: 5000 },
  ];
  assert.equal(discountFor(offer({ categories: "Skin" }), services), 2000);
  assert.equal(discountFor(offer({ discountType: "AMOUNT", value: 99999 }), services), 15000); // never more than the price
});

test("offers: best single offer wins and first-visit offers need a first visit", () => {
  const services = [{ id: "a", category: "Skin", priceCents: 10000 }];
  const offers = [offer({ id: "welcome", value: 30, firstVisitOnly: true }), offer({ id: "glow", value: 20, categories: "Skin" })];
  assert.equal(bestOffer(offers, services, true)?.offer.id, "welcome");
  assert.equal(bestOffer(offers, services, false)?.offer.id, "glow");
});
