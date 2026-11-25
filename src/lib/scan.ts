// Camera skin / hair / hands scan. Runs entirely in the browser on the client's own photo — the photo is never
// uploaded or saved. It measures simple, explainable things in the pixels (shine, texture, redness, spots,
// strand direction, grey/vivid colour) and turns them into SUGGESTED quiz answers that the client can change.
// It's an estimate that depends on lighting and camera — not a medical diagnosis.

import type { SkinAnswers } from "./skin";

export type ScanKind = "face" | "hair" | "hands";

export interface Pixels {
  data: Uint8ClampedArray | number[]; // RGBA
  width: number;
  height: number;
}

export interface Finding {
  key: string;
  label: string;
  score: number; // 0–100, shown as a bar
  text: string;
}

export type SuggestedAnswers = Partial<Record<keyof SkinAnswers, string | string[]>>;

export interface ScanResult {
  kind: ScanKind;
  ok: boolean;
  problem?: string; // why the photo couldn't be used (too dark, blurry, no face…)
  headline: string;
  findings: Finding[];
  suggest: SuggestedAnswers;
}

/** Where to line things up in the camera frame (fractions of a 3:4 portrait frame). The scan crops to this box. */
export const GUIDES: Record<ScanKind, { x: number; y: number; w: number; h: number; shape: "oval" | "rect"; tip: string; facing: "user" | "environment" }> = {
  face: { x: 0.19, y: 0.1, w: 0.62, h: 0.78, shape: "oval", facing: "user", tip: "Fit your face in the oval. No makeup or filters, face a window (daylight), hair off your forehead." },
  hair: { x: 0.1, y: 0.12, w: 0.8, h: 0.7, shape: "rect", facing: "environment", tip: "Fill the box with your hair (lengths or your parting) in good light. Ask someone to help, or use a mirror." },
  hands: { x: 0.1, y: 0.15, w: 0.8, h: 0.65, shape: "rect", facing: "environment", tip: "Back of your hand and nails flat in the box, fingers together, in good light." },
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => Math.round(clamp(n));

// ---------- pixel helpers ----------

interface Px {
  w: number;
  h: number;
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  lum: Float32Array; // 0–1
  sat: Float32Array; // 0–1
  skin: Uint8Array; // 1 = looks like skin (any skin tone)
}

function prepare(p: Pixels): Px {
  const n = p.width * p.height;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), lum = new Float32Array(n), sat = new Float32Array(n);
  const skin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const R = p.data[i * 4], G = p.data[i * 4 + 1], B = p.data[i * 4 + 2];
    r[i] = R; g[i] = G; b[i] = B;
    const Y = 0.299 * R + 0.587 * G + 0.114 * B;
    lum[i] = Y / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
    // YCbCr skin rule — works across light and dark skin tones reasonably well.
    const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
    const Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
    skin[i] = Y > 35 && Cr >= 132 && Cr <= 180 && Cb >= 75 && Cb <= 135 && R > G ? 1 : 0;
  }
  return { w: p.width, h: p.height, r, g, b, lum, sat, skin };
}

type Rect = { x: number; y: number; w: number; h: number }; // fractions
// onlySkin: true = skin pixels plus shiny highlights on skin (highlights are near-white, so the skin-colour test misses them)
function indices(px: Px, rects: Rect[], onlySkin: boolean | "not"): number[] {
  const out: number[] = [];
  for (const rc of rects) {
    const x0 = Math.floor(rc.x * px.w), x1 = Math.min(px.w - 1, Math.ceil((rc.x + rc.w) * px.w));
    const y0 = Math.floor(rc.y * px.h), y1 = Math.min(px.h - 1, Math.ceil((rc.y + rc.h) * px.h));
    for (let y = Math.max(1, y0); y < Math.min(px.h - 1, y1); y++)
      for (let x = Math.max(1, x0); x < x1; x++) {
        const i = y * px.w + x;
        if (onlySkin === true && !px.skin[i] && !(px.lum[i] > 0.7 && px.sat[i] < 0.3 && nearSkin(px, i))) continue;
        if (onlySkin === "not" && px.skin[i]) continue;
        out.push(i);
      }
  }
  return out;
}

/** A highlight counts as skin shine only if skin is right around it (not a white wall or eyes). */
function nearSkin(px: Px, i: number) {
  const w = px.w, d = 3;
  return !!(px.skin[i - d] || px.skin[i + d] || px.skin[i - d * w] || px.skin[i + d * w]);
}

function meanStd(arr: Float32Array, idx: number[]) {
  if (!idx.length) return { mean: 0, std: 0 };
  let s = 0;
  for (const i of idx) s += arr[i];
  const mean = s / idx.length;
  let v = 0;
  for (const i of idx) v += (arr[i] - mean) ** 2;
  return { mean, std: Math.sqrt(v / idx.length) };
}

/** Fraction of pixels that are specular highlights (shine): much brighter than their surroundings and nearly white. */
function shine(px: Px, idx: number[]) {
  if (idx.length < 30) return 0;
  const { mean, std } = meanStd(px.lum, idx);
  const thr = Math.max(0.7, mean + 2 * std);
  let n = 0;
  for (const i of idx) if (px.lum[i] > thr && px.sat[i] < 0.3) n++;
  return n / idx.length;
}

/** Fine texture: how much each pixel differs from its 3×3 neighbourhood (0–255 scale). Pores, roughness, flakes. */
function texture(px: Px, idx: number[]) {
  if (!idx.length) return 0;
  let s = 0;
  const w = px.w, L = px.lum;
  for (const i of idx) {
    const avg = (L[i - w - 1] + L[i - w] + L[i - w + 1] + L[i - 1] + L[i + 1] + L[i + w - 1] + L[i + w] + L[i + w + 1]) / 8;
    s += Math.abs(L[i] - avg);
  }
  return (s / idx.length) * 255;
}

/** Sharpness of the whole crop (mean absolute Laplacian, 0–255 scale). Low = blurry photo. */
function sharpness(px: Px) {
  let s = 0, n = 0;
  const w = px.w, L = px.lum;
  for (let y = 1; y < px.h - 1; y += 2)
    for (let x = 1; x < w - 1; x += 2) {
      const i = y * w + x;
      s += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
      n++;
    }
  return n ? (s / n) * 255 : 0;
}

function redIndex(px: Px, i: number) {
  return (px.r[i] - px.g[i]) / (px.r[i] + px.g[i] + px.b[i] + 1);
}

function lightingProblem(px: Px, idx: number[], minLight = 0.16): string | null {
  const { mean } = meanStd(px.lum, idx.length ? idx : indices(px, [{ x: 0, y: 0, w: 1, h: 1 }], false));
  if (mean < minLight) return "The photo is too dark. Face a window or turn on a light, then try again.";
  if (mean > 0.9) return "The photo is too bright (washed out). Move away from direct light and try again.";
  if (sharpness(px) < 1.1) return "The photo is blurry. Hold the phone still (or rest it on something) and try again.";
  return null;
}

// ---------- face ----------

function analyzeFace(p: Pixels): ScanResult {
  const px = prepare(p);
  const center = indices(px, [{ x: 0.2, y: 0.15, w: 0.6, h: 0.7 }], false);
  const centerSkin = center.filter((i) => px.skin[i]).length / Math.max(1, center.length);
  const fail = (problem: string): ScanResult => ({ kind: "face", ok: false, problem, headline: "Let's try that again", findings: [], suggest: {} });
  if (centerSkin < 0.35) return fail("We couldn't see your face clearly. Fit your face in the oval, take off glasses if you can, and avoid filters.");
  const light = lightingProblem(px, center);
  if (light) return fail(light);

  const forehead = indices(px, [{ x: 0.3, y: 0.1, w: 0.4, h: 0.18 }], true);
  const nose = indices(px, [{ x: 0.42, y: 0.4, w: 0.16, h: 0.24 }], true);
  const chin = indices(px, [{ x: 0.4, y: 0.8, w: 0.2, h: 0.1 }], true);
  const cheeks = indices(px, [{ x: 0.13, y: 0.45, w: 0.21, h: 0.22 }, { x: 0.66, y: 0.45, w: 0.21, h: 0.22 }], true);
  const tzone = [...forehead, ...nose, ...chin];
  const allSkin = [...tzone, ...cheeks];

  const tShine = shine(px, tzone), cShine = shine(px, cheeks);
  const cheekTex = texture(px, cheeks), noseTex = texture(px, nose);

  const redOf = (idx: number[]) => idx.reduce((s, i) => s + redIndex(px, i), 0) / Math.max(1, idx.length);
  const cheekRed = redOf(cheeks), foreRed = redOf(forehead);
  const rAll = allSkin.map((i) => redIndex(px, i));
  const rMean = rAll.reduce((a, b) => a + b, 0) / Math.max(1, rAll.length);
  const rStd = Math.sqrt(rAll.reduce((a, b) => a + (b - rMean) ** 2, 0) / Math.max(1, rAll.length));
  const redSpots = rAll.filter((v) => v > rMean + 2.2 * rStd && v > 0.12).length / Math.max(1, rAll.length);

  const spotArea = [...cheeks, ...forehead];
  const ls = meanStd(px.lum, spotArea);
  const darkSpots = spotArea.filter((i) => px.lum[i] < ls.mean - 2.3 * ls.std).length / Math.max(1, spotArea.length);
  const glow = ls.mean * 0.6 + (tShine + cShine) * 4;

  // Skin type from where the shine is.
  let skinFeel: SkinAnswers["skinFeel"];
  if (tShine >= 0.035 && cShine >= 0.02) skinFeel = "oily";
  else if (tShine >= 0.02 && tShine > cShine * 1.8) skinFeel = "combination";
  else if (tShine + cShine < 0.012 && cheekTex > 4.5) skinFeel = "dry";
  else skinFeel = "normal";

  const pores: SkinAnswers["pores"] = noseTex > 7 || cheekTex > 6.5 ? "large" : noseTex > 4.5 && noseTex > cheekTex * 1.35 ? "nose" : "small";

  const redness = clamp(((cheekRed - foreRed) / 0.05) * 60 + (cheekRed > 0.2 ? 30 : 0));
  const concerns: SkinAnswers["concerns"] = [];
  if (redSpots > 0.02) concerns.push("acne");
  if (redness > 55) concerns.push("redness");
  if (darkSpots > 0.02) concerns.push("pigmentation");
  if (skinFeel === "dry") concerns.push("dehydration");
  if (glow < 0.3 && concerns.length < 3) concerns.push("dullness");

  const oil = pct(((tShine + cShine) / 2 / 0.05) * 100);
  const TYPE_TEXT = {
    oily: "Shine on your forehead, nose and cheeks — your skin makes plenty of oil.",
    combination: "Shine mostly on your forehead and nose (T-zone), less on your cheeks.",
    dry: "Very little shine and a slightly rough texture — your skin may be dry.",
    normal: "Balanced shine — your skin looks comfortable.",
  };
  const findings: Finding[] = [
    { key: "oil", label: "Oil & shine", score: oil, text: TYPE_TEXT[skinFeel] },
    { key: "texture", label: "Pores & texture", score: pct((Math.max(cheekTex, noseTex) / 9) * 100), text: pores === "large" ? "Pores look visible on much of your face." : pores === "nose" ? "Pores are most visible around your nose." : "Pores look small and skin looks smooth." },
    { key: "redness", label: "Redness", score: pct(redness), text: redness > 55 ? "Some redness on your cheeks — skin may be sensitive or irritated." : "Little redness." },
    { key: "spots", label: "Spots & blemishes", score: pct(Math.max(redSpots, darkSpots) / 0.04 * 100), text: [redSpots > 0.02 && "some red spots (possible breakouts)", darkSpots > 0.02 && "some darker spots (uneven tone)"].filter(Boolean).join(" and ") || "Even tone, few spots." },
    { key: "glow", label: "Radiance", score: pct(glow * 140), text: glow < 0.3 ? "Skin looks a little dull or tired." : "Healthy glow." },
  ];
  const suggest: SuggestedAnswers = { skinFeel, pores };
  if (concerns.length) suggest.concerns = concerns.slice(0, 3);
  if (redness > 70) suggest.reactivity = "sometimes";
  const label = { oily: "Oily", combination: "Combination", dry: "Dry", normal: "Normal" }[skinFeel];
  return { kind: "face", ok: true, headline: `Looks like ${label.toLowerCase()} skin`, findings, suggest };
}

// ---------- hair ----------

function analyzeHair(p: Pixels): ScanResult {
  const px = prepare(p);
  const all = indices(px, [{ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }], false);
  const fail = (problem: string): ScanResult => ({ kind: "hair", ok: false, problem, headline: "Let's try that again", findings: [], suggest: {} });
  const skinFrac = all.filter((i) => px.skin[i]).length / Math.max(1, all.length);
  if (skinFrac > 0.7) return fail("That looks like skin, not hair. Point the camera at your hair (lengths or your parting) and fill the box.");
  const light = lightingProblem(px, all, 0.07); // dark hair is naturally dark
  if (light) return fail(light);
  const hair = all.filter((i) => !px.skin[i]);

  // Strand direction in small blocks (structure tensor): straight hair → one direction everywhere; curls → many.
  const B = Math.max(8, Math.round(px.w / 24));
  let cohSum = 0, energySum = 0, cx = 0, cy = 0, blocks = 0;
  const L = px.lum, w = px.w;
  for (let by = 1; by + B < px.h - 1; by += B)
    for (let bx = 1; bx + B < px.w - 1; bx += B) {
      let jxx = 0, jyy = 0, jxy = 0, skinN = 0;
      for (let y = by; y < by + B; y++)
        for (let x = bx; x < bx + B; x++) {
          const i = y * w + x;
          if (px.skin[i]) skinN++;
          const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1]) * 255;
          const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1]) * 255;
          jxx += gx * gx; jyy += gy * gy; jxy += gx * gy;
        }
      if (skinN > B * B * 0.5) continue;
      const energy = (jxx + jyy) / (B * B);
      if (energy < 40) continue; // flat area (background, blown-out light)
      const coh = Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy) / (jxx + jyy + 1e-6);
      const th2 = Math.atan2(2 * jxy, jxx - jyy); // doubled angle
      cohSum += coh; energySum += energy; cx += Math.cos(th2); cy += Math.sin(th2); blocks++;
    }
  if (blocks < 6) return fail("We couldn't see enough hair detail. Move closer so hair fills the box, in good light.");
  const coherence = cohSum / blocks; // 0 = messy/fuzzy, 1 = neat parallel strands
  const spread = 1 - Math.sqrt(cx * cx + cy * cy) / blocks; // 0 = same direction everywhere

  let hairType: SkinAnswers["hairType"];
  if (spread < 0.3 && coherence > 0.4) hairType = "straight";
  else if (spread < 0.6) hairType = "wavy";
  else if (coherence < 0.3) hairType = "coily";
  else hairType = "curly";

  const fine = texture(px, hair);
  const hShine = shine(px, hair);
  let grey = 0, vivid = 0;
  for (const i of hair) {
    if (px.sat[i] < 0.12 && px.lum[i] > 0.55) grey++;
    if (px.sat[i] > 0.45 && px.lum[i] > 0.15) {
      const R = px.r[i], G = px.g[i], Bv = px.b[i];
      const mx = Math.max(R, G, Bv), mn = Math.min(R, G, Bv);
      let hue = 0;
      if (mx === R) hue = ((G - Bv) / (mx - mn + 1e-6)) * 60;
      else if (mx === G) hue = (2 + (Bv - R) / (mx - mn + 1e-6)) * 60;
      else hue = (4 + (R - G) / (mx - mn + 1e-6)) * 60;
      if (hue < 0) hue += 360;
      if (hue > 50 && hue < 330) vivid++; // greens, blues, purples, pinks — not natural shades
    }
  }
  const greyFrac = grey / Math.max(1, hair.length), vividFrac = vivid / Math.max(1, hair.length);

  const frizzScore = clamp((0.5 - coherence) * 180 + (fine - 6) * 6 + (hairType === "straight" ? 10 : -10));
  const dryScore = clamp(70 - hShine * 2500 + (fine - 6) * 4);
  const hairConcerns: SkinAnswers["hairConcerns"] = [];
  if (frizzScore > 55) hairConcerns.push("frizz");
  if (dryScore > 60 && (frizzScore > 40 || hShine < 0.004)) hairConcerns.push("damage");
  if (greyFrac > 0.12 || vividFrac > 0.08) hairConcerns.push("color");
  if (skinFrac > 0.3) hairConcerns.push("thinning");

  const TYPE = { straight: "Straight", wavy: "Wavy", curly: "Curly", coily: "Coily / afro-textured" };
  const findings: Finding[] = [
    { key: "pattern", label: "Curl pattern", score: pct(spread * 100), text: `${TYPE[hairType]} — strands run ${spread < 0.3 ? "mostly in one direction" : spread < 0.6 ? "in soft waves" : "in many directions (curls or coils)"}.` },
    { key: "frizz", label: "Frizz", score: pct(frizzScore), text: frizzScore > 55 ? "Lots of flyaways and fuzzy texture." : "Strands look fairly smooth." },
    { key: "shine", label: "Shine & moisture", score: pct(100 - dryScore), text: dryScore > 60 ? "Hair looks dry or dull — it may need moisture and repair." : "Good shine — hair looks healthy." },
    { key: "colour", label: "Colour", score: pct(Math.max(greyFrac / 0.25, vividFrac / 0.15) * 100), text: vividFrac > 0.08 ? "Fashion colour spotted — colour-care products will keep it bright." : greyFrac > 0.12 ? "Some grey or silver strands — ask about colour or gloss." : "Natural, even colour." },
  ];
  if (skinFrac > 0.3) findings.push({ key: "scalp", label: "Scalp showing", score: pct(skinFrac * 120), text: "Quite a lot of scalp shows through — a scalp treatment may help (lighting and parting can affect this)." });
  const suggest: SuggestedAnswers = { hairType };
  suggest.hairConcerns = hairConcerns;
  return { kind: "hair", ok: true, headline: `${TYPE[hairType]} hair${hairConcerns.length ? ` · ${hairConcerns.length} thing${hairConcerns.length > 1 ? "s" : ""} to care for` : ""}`, findings, suggest };
}

// ---------- hands & nails ----------

function analyzeHands(p: Pixels): ScanResult {
  const px = prepare(p);
  const all = indices(px, [{ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }], false);
  const fail = (problem: string): ScanResult => ({ kind: "hands", ok: false, problem, headline: "Let's try that again", findings: [], suggest: {} });
  const skin = all.filter((i) => px.skin[i]);
  if (skin.length / Math.max(1, all.length) < 0.25) return fail("We couldn't see your hand clearly. Lay it flat in the box, in good light.");
  const light = lightingProblem(px, skin);
  if (light) return fail(light);

  const tex = texture(px, skin);
  const sh = shine(px, skin);
  const ls = meanStd(px.lum, skin);
  const flakes = skin.filter((i) => px.lum[i] > ls.mean + 1.6 * ls.std && px.sat[i] < 0.15).length / Math.max(1, skin.length);
  let polish = 0;
  for (const i of all) if (!px.skin[i] && px.sat[i] > 0.45 && px.lum[i] > 0.12 && px.lum[i] < 0.92) polish++;
  const polishFrac = polish / Math.max(1, all.length);

  const dryScore = clamp((tex - 3) * 14 + flakes * 900 - sh * 800);
  const nailConcerns: string[] = [];
  if (dryScore > 55) nailConcerns.push("dryhands", "cuticles");
  if (polishFrac > 0.015) nailConcerns.push("art");
  const findings: Finding[] = [
    { key: "dry", label: "Dryness", score: pct(dryScore), text: dryScore > 55 ? "Skin on your hands looks dry (fine lines or flaky texture) — cuticles are likely dry too." : "Hands look well moisturised." },
    { key: "polish", label: "Polish", score: pct((polishFrac / 0.05) * 100), text: polishFrac > 0.015 ? "Polish spotted — time for a fresh manicure or some nail art?" : "No polish — a classic manicure keeps nails neat and strong." },
  ];
  return { kind: "hands", ok: true, headline: dryScore > 55 ? "Hands & cuticles could use some care" : "Hands look healthy", findings, suggest: { nailConcerns: nailConcerns as SkinAnswers["nailConcerns"] } };
}

export function analyzeScan(kind: ScanKind, p: Pixels): ScanResult {
  return kind === "face" ? analyzeFace(p) : kind === "hair" ? analyzeHair(p) : analyzeHands(p);
}

/** Combines several scans into one set of suggested answers for the quiz. */
export function mergeSuggestions(results: ScanResult[]): SuggestedAnswers {
  const out: SuggestedAnswers = {};
  for (const r of results) {
    if (!r.ok) continue;
    for (const [k, v] of Object.entries(r.suggest) as [keyof SkinAnswers, string | string[]][]) {
      if (Array.isArray(v)) {
        const cur = (out[k] as string[] | undefined) ?? [];
        out[k] = [...new Set([...cur, ...v])].slice(0, k === "concerns" ? 3 : 5);
      } else out[k] = v;
    }
  }
  return out;
}
