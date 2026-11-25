import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeScan, mergeSuggestions, Pixels } from "../src/lib/scan";
import { analyzeSkin, parseAnswers, rankItems } from "../src/lib/skin";

// Small synthetic "photos" so the analysis can be tested without real images.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  return { data, width: w, height: h };
}

const W = 220, H = 280;
const inRect = (x: number, y: number, rx: number, ry: number, rw: number, rh: number) => x >= rx * W && x < (rx + rw) * W && y >= ry * H && y < (ry + rh) * H;
/** Skin-coloured face with light grain; `shiny(x, y)` decides where shine highlights go. */
function face(shiny: (x: number, y: number) => boolean) {
  return image(W, H, (x, y) => {
    const n = (rand() - 0.5) * 18;
    if (shiny(x, y) && (x * 7 + y * 13) % 9 === 0) return [252, 248, 245];
    return [200 + n, 150 + n, 122 + n];
  });
}
const tzone = (x: number, y: number) => inRect(x, y, 0.3, 0.1, 0.4, 0.18) || inRect(x, y, 0.42, 0.4, 0.16, 0.24) || inRect(x, y, 0.4, 0.8, 0.2, 0.1);
const cheeks = (x: number, y: number) => inRect(x, y, 0.13, 0.45, 0.21, 0.22) || inRect(x, y, 0.66, 0.45, 0.21, 0.22);

test("scan: shine all over reads as oily skin", () => {
  const r = analyzeScan("face", face((x, y) => tzone(x, y) || cheeks(x, y)));
  assert.equal(r.ok, true, r.problem);
  assert.equal(r.suggest.skinFeel, "oily");
});

test("scan: shine only on the T-zone reads as combination skin", () => {
  const r = analyzeScan("face", face(tzone));
  assert.equal(r.ok, true, r.problem);
  assert.equal(r.suggest.skinFeel, "combination");
});

test("scan: rejects photos that are too dark or don't show a face", () => {
  const dark = analyzeScan("face", image(W, H, () => [30 + rand() * 6, 18, 14]));
  assert.equal(dark.ok, false);
  const wall = analyzeScan("face", image(W, H, () => [60 + rand() * 30, 110 + rand() * 30, 200]));
  assert.equal(wall.ok, false);
  assert.match(wall.problem ?? "", /face/);
});

test("scan: parallel strands read as straight hair, swirls as curly/coily", () => {
  const straight = analyzeScan("hair", image(W, H, (x) => { const v = 60 + 50 * Math.sin(x / 2.2) + rand() * 10; return [v * 0.55, v * 0.4, v * 0.3]; }));
  assert.equal(straight.ok, true, straight.problem);
  assert.equal(straight.suggest.hairType, "straight");
  const curly = analyzeScan("hair", image(W, H, (x, y) => {
    const cx = Math.round(x / 22) * 22, cy = Math.round(y / 22) * 22;
    const v = 60 + 50 * Math.sin(Math.hypot(x - cx, y - cy) / 1.6) + rand() * 10;
    return [v * 0.55, v * 0.4, v * 0.3];
  }));
  assert.equal(curly.ok, true, curly.problem);
  assert.ok(["curly", "coily"].includes(String(curly.suggest.hairType)), String(curly.suggest.hairType));
});

test("scan: merged suggestions keep at most 3 skin concerns", () => {
  const base = { kind: "face" as const, ok: true, headline: "", findings: [] };
  const m = mergeSuggestions([
    { ...base, suggest: { concerns: ["acne", "redness"] } },
    { ...base, suggest: { concerns: ["pigmentation", "dullness"], hairType: "wavy" } },
  ]);
  assert.deepEqual(m.concerns, ["acne", "redness", "pigmentation"]);
  assert.equal(m.hairType, "wavy");
});

test("skin check: older saved answers without hands & nails still work, and nail answers match nail services", () => {
  const old = { skinFeel: "dry", pores: "small", reactivity: "rarely", concerns: ["dehydration"], age: "25to34", sun: "daily", hairType: "wavy", hairConcerns: [], goal: "glow" };
  const parsed = parseAnswers(old);
  assert.ok(parsed);
  assert.deepEqual(parsed.nailConcerns, []);
  const withNails = analyzeSkin({ ...parsed, nailConcerns: ["cuticles"] });
  assert.ok(withNails.needs.includes("nails"));
  const ranked = rankItems([{ name: "Classic Manicure", targets: "nails" }, { name: "Men's Cut", targets: "" }], withNails, 5);
  assert.equal(ranked[0]?.item.name, "Classic Manicure");
});
