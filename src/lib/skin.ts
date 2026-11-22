// Online skin & hair check: the questions, the analysis, and the matching of services/products.
// Pure functions (no database) so they're easy to test. Not a medical diagnosis.

export const TARGETS = {
  // skin types
  oily: "Oily skin",
  combination: "Combination skin",
  dry: "Dry skin",
  normal: "Normal skin",
  sensitive: "Sensitive skin",
  // skin concerns
  acne: "Breakouts",
  pores: "Visible pores",
  pigmentation: "Dark spots",
  aging: "Fine lines",
  dullness: "Dullness",
  redness: "Redness",
  dehydration: "Dehydration",
  // hair
  frizz: "Frizz",
  damage: "Damaged hair",
  thinning: "Thinning hair",
  color: "Colour care",
  scalp: "Scalp care",
  curly: "Curls & coils",
  // other
  event: "Special event",
  nails: "Nails",
  strong: "Strong (not for very sensitive skin)",
} as const;
export type Target = keyof typeof TARGETS;
export const TARGET_KEYS = Object.keys(TARGETS) as Target[];

export interface Question {
  id: keyof SkinAnswers;
  title: string;
  help?: string;
  multi?: boolean;
  max?: number;
  options: { value: string; label: string; note?: string }[];
}

export interface SkinAnswers {
  skinFeel: "oily" | "combination" | "dry" | "normal";
  pores: "large" | "nose" | "small";
  reactivity: "often" | "sometimes" | "rarely";
  concerns: ("acne" | "pigmentation" | "aging" | "dullness" | "redness" | "dehydration")[];
  age: "under25" | "25to34" | "35to44" | "45plus";
  sun: "daily" | "sometimes" | "never";
  hairType: "straight" | "wavy" | "curly" | "coily";
  hairConcerns: ("frizz" | "damage" | "thinning" | "color" | "scalp")[];
  goal: "glow" | "fix" | "event" | "relax";
}

export const QUESTIONS: Question[] = [
  {
    id: "skinFeel",
    title: "By midday, how does your skin usually feel?",
    help: "Think of a normal day without makeup.",
    options: [
      { value: "oily", label: "Shiny all over", note: "I often blot or powder" },
      { value: "combination", label: "Shiny on forehead and nose only", note: "Cheeks feel normal or dry" },
      { value: "dry", label: "Tight, rough or flaky", note: "I need moisturiser often" },
      { value: "normal", label: "Comfortable and balanced" },
    ],
  },
  {
    id: "pores",
    title: "How do your pores look?",
    options: [
      { value: "large", label: "Large and visible on most of my face" },
      { value: "nose", label: "Visible mainly on my nose" },
      { value: "small", label: "Barely visible" },
    ],
  },
  {
    id: "reactivity",
    title: "Does your skin react to new products (stinging, redness, itching)?",
    options: [
      { value: "often", label: "Often — my skin is easily irritated" },
      { value: "sometimes", label: "Sometimes" },
      { value: "rarely", label: "Rarely or never" },
    ],
  },
  {
    id: "concerns",
    title: "What would you most like to improve?",
    help: "Choose up to 3.",
    multi: true,
    max: 3,
    options: [
      { value: "acne", label: "Breakouts & blackheads" },
      { value: "pigmentation", label: "Dark spots & uneven tone" },
      { value: "aging", label: "Fine lines & firmness" },
      { value: "dullness", label: "Dull, tired-looking skin" },
      { value: "redness", label: "Redness & irritation" },
      { value: "dehydration", label: "Dehydration & tightness" },
    ],
  },
  {
    id: "age",
    title: "Your age range",
    help: "Skin needs change with age — this helps us fine-tune your routine.",
    options: [
      { value: "under25", label: "Under 25" },
      { value: "25to34", label: "25–34" },
      { value: "35to44", label: "35–44" },
      { value: "45plus", label: "45+" },
    ],
  },
  {
    id: "sun",
    title: "How often do you wear sunscreen?",
    options: [
      { value: "daily", label: "Every day" },
      { value: "sometimes", label: "Sometimes / only in summer" },
      { value: "never", label: "Rarely or never" },
    ],
  },
  {
    id: "hairType",
    title: "Your natural hair type",
    options: [
      { value: "straight", label: "Straight" },
      { value: "wavy", label: "Wavy" },
      { value: "curly", label: "Curly" },
      { value: "coily", label: "Coily / afro-textured" },
    ],
  },
  {
    id: "hairConcerns",
    title: "Any hair or scalp concerns?",
    help: "Choose any that apply (or none).",
    multi: true,
    max: 5,
    options: [
      { value: "frizz", label: "Frizz" },
      { value: "damage", label: "Dry, damaged or breaking hair" },
      { value: "thinning", label: "Thinning or shedding" },
      { value: "color", label: "Colour-treated hair" },
      { value: "scalp", label: "Oily, itchy or flaky scalp" },
    ],
  },
  {
    id: "goal",
    title: "What's your main goal right now?",
    options: [
      { value: "glow", label: "Healthy glow & maintenance" },
      { value: "fix", label: "Fix a specific concern" },
      { value: "event", label: "Look my best for an event" },
      { value: "relax", label: "Relax and treat myself" },
    ],
  },
];

/** Checks answers coming from the browser against the allowed options. Returns null if invalid. */
export function parseAnswers(raw: unknown): SkinAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const q of QUESTIONS) {
    const allowed = q.options.map((o) => o.value);
    const v = r[q.id];
    if (q.multi) {
      if (!Array.isArray(v)) return null;
      const vals = [...new Set(v.filter((x): x is string => typeof x === "string" && allowed.includes(x)))].slice(0, q.max ?? 5);
      if (q.id === "concerns" && vals.length === 0) return null;
      out[q.id] = vals;
    } else {
      if (typeof v !== "string" || !allowed.includes(v)) return null;
      out[q.id] = v;
    }
  }
  return out as unknown as SkinAnswers;
}

export interface SkinAnalysis {
  skinType: "oily" | "combination" | "dry" | "normal";
  sensitivity: "high" | "medium" | "low";
  concerns: Target[];
  hairType: string;
  hairConcerns: Target[];
  needs: Target[]; // everything we try to match services/products against
  headline: string;
  summary: string;
  routine: { am: string[]; pm: string[]; weekly: string[] };
  tips: string[];
}

const SKIN_LABEL = { oily: "oily", combination: "combination", dry: "dry", normal: "balanced (normal)" };

export function analyzeSkin(a: SkinAnswers): SkinAnalysis {
  const skinType = a.skinFeel;
  const sensitivity = a.reactivity === "often" ? "high" : a.reactivity === "sometimes" ? "medium" : "low";
  const concerns = new Set<Target>(a.concerns);
  if (a.pores === "large" || (a.pores === "nose" && (skinType === "oily" || skinType === "combination"))) concerns.add("pores");
  if (skinType === "dry") concerns.add("dehydration");
  if ((a.age === "35to44" || a.age === "45plus") && a.sun !== "daily") concerns.add("aging");
  if (a.reactivity === "often") concerns.add("redness");

  const hairConcerns = new Set<Target>(a.hairConcerns);
  if (a.hairType === "curly" || a.hairType === "coily") hairConcerns.add("curly");

  const needs = new Set<Target>([skinType, ...concerns, ...hairConcerns]);
  if (sensitivity === "high") needs.add("sensitive");
  if (a.goal === "event") needs.add("event");

  const top = [...concerns].slice(0, 2).map((c) => TARGETS[c].toLowerCase());
  const headline = `${sensitivity === "high" ? "Sensitive, " : ""}${SKIN_LABEL[skinType]} skin${top.length ? ` focused on ${top.join(" & ")}` : ""}`;

  const cleanser = skinType === "oily" || skinType === "combination" ? (sensitivity === "high" ? "a gentle gel cleanser" : "a clarifying gel cleanser") : "a creamy, non-foaming cleanser";
  const moisturiser = skinType === "oily" ? "an oil-free gel moisturiser" : skinType === "dry" ? "a rich barrier cream" : "a light lotion";
  const am = [`Cleanse with ${cleanser}`];
  if (concerns.has("pigmentation") || concerns.has("dullness")) am.push(sensitivity === "high" ? "Hydrating serum (introduce vitamin C slowly)" : "Vitamin C serum for brightness");
  else if (concerns.has("acne") || concerns.has("pores")) am.push("Niacinamide serum to balance oil");
  else am.push("Hyaluronic serum for hydration");
  am.push(`Finish with ${moisturiser}`, "Mineral SPF 30–50, every day — even when it's cloudy");

  const pm = [`Cleanse with ${cleanser} (double-cleanse if you wore SPF or makeup)`];
  if (concerns.has("aging") || concerns.has("pigmentation")) pm.push(sensitivity === "high" ? "Calming serum; ask us before starting retinoids" : "Gentle retinal 2–3 nights a week, building up slowly");
  else if (concerns.has("acne")) pm.push("Niacinamide or a light salicylic treatment on breakout areas");
  else pm.push("Hydrating serum");
  pm.push(skinType === "dry" || concerns.has("dehydration") ? "Rich barrier cream" : moisturiser.replace(/^an? /, "A "));

  const weekly: string[] = [];
  if (sensitivity !== "high" && (skinType === "oily" || concerns.has("pores"))) weekly.push("Clay mask once a week");
  if (sensitivity !== "high" && concerns.has("dullness")) weekly.push("Gentle exfoliation once a week");
  if (skinType === "dry" || concerns.has("dehydration")) weekly.push("Overnight hydrating mask 1–2 times a week");
  if (hairConcerns.has("damage") || hairConcerns.has("color") || hairConcerns.has("frizz")) weekly.push("Bond-repair or deep-conditioning hair mask");
  if (hairConcerns.has("scalp") || hairConcerns.has("thinning")) weekly.push("Scalp scrub or massage to boost circulation");

  const tips: string[] = [];
  if (a.sun !== "daily") tips.push("Daily sunscreen is the single biggest thing you can do for dark spots and fine lines.");
  if (sensitivity === "high") tips.push("Patch-test new products on your jaw for 48 hours, and introduce one new product at a time.");
  if (concerns.has("acne")) tips.push("Avoid picking — and change pillowcases twice a week.");
  if (skinType === "dry") tips.push("Apply moisturiser on slightly damp skin to lock hydration in.");
  if (hairConcerns.has("curly")) tips.push("Detangle curls only when wet and conditioned, using fingers or a wide-tooth comb.");
  if (hairConcerns.has("color")) tips.push("Wash colour-treated hair in lukewarm water and use a sulphate-free shampoo.");

  return {
    skinType,
    sensitivity,
    concerns: [...concerns],
    hairType: a.hairType,
    hairConcerns: [...hairConcerns],
    needs: [...needs],
    headline: headline.charAt(0).toUpperCase() + headline.slice(1),
    summary:
      `Your answers point to ${SKIN_LABEL[skinType]} skin with ${sensitivity} sensitivity. ` +
      (concerns.size ? `We'll focus on ${[...concerns].map((c) => TARGETS[c].toLowerCase()).join(", ")}. ` : "") +
      `Your stylist will confirm this with a quick in-person skin check at your visit.`,
    routine: { am, pm, weekly },
    tips,
  };
}

const WEIGHT: Partial<Record<Target, number>> = { oily: 1.5, combination: 1.5, dry: 1.5, normal: 1, sensitive: 2.5 };

/** How well an item (service/product) matches the client's needs, with human-readable reasons. */
export function matchItem(itemTargets: string, analysis: Pick<SkinAnalysis, "needs" | "sensitivity">) {
  const targets = itemTargets.split(",").map((t) => t.trim()).filter(Boolean) as Target[];
  if (analysis.sensitivity === "high" && targets.includes("strong")) return { score: 0, reasons: [] as string[] };
  let score = 0;
  const reasons: string[] = [];
  for (const t of targets) {
    if (t === "strong" || !analysis.needs.includes(t)) continue;
    score += WEIGHT[t] ?? 2;
    reasons.push(TARGETS[t]);
  }
  return { score, reasons };
}

/** Ranks items by match score (best first), dropping items that don't match at all. */
export function rankItems<T extends { targets: string }>(items: T[], analysis: Pick<SkinAnalysis, "needs" | "sensitivity">, limit: number) {
  return items
    .map((item) => ({ item, ...matchItem(item.targets, analysis) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
