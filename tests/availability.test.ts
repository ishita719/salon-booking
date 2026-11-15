import assert from "node:assert/strict";
import { test } from "node:test";
import { computeSlots, dateProblem } from "../src/lib/availability";
import { minutesUntil, salonNow } from "../src/lib/time";

// Fixed "now": Wed 2026-11-18 08:00 in Vancouver. BC's UTC offset depends on time-zone rules
// (UTC-8 or UTC-7), so find the instant that is 08:00 there instead of hard-coding it.
const NOW = [6, 7, 8, 9]
  .map((h) => new Date(`2026-11-18T${String(8 + h).padStart(2, "0")}:00:00Z`))
  .find((d) => salonNow(d).minutes === 8 * 60)!;

test("salonNow uses Vancouver time", () => {
  assert.deepEqual(salonNow(NOW), { date: "2026-11-18", minutes: 8 * 60 });
});

test("closed on Mondays and past dates rejected", () => {
  assert.match(dateProblem("2026-11-23", NOW)!, /closed/); // Monday
  assert.match(dateProblem("2026-11-17", NOW)!, /past/);
  assert.equal(dateProblem("2026-11-19", NOW), null);
});

test("same-day slots respect 2-hour notice", () => {
  const slots = computeSlots({ date: "2026-11-18", durationMin: 60, locationType: "SALON", stylistIds: ["a"], busy: [], now: NOW });
  assert.equal(slots[0].startMin, 10 * 60); // 8:00 + 2h
  assert.equal(slots.at(-1)!.startMin, 18 * 60); // Wed closes 19:00
});

test("booked stylist is not offered an overlapping slot", () => {
  const busy = [{ stylistId: "a", startMin: 600, endMin: 660, locationType: "SALON" }];
  const slots = computeSlots({ date: "2026-11-19", durationMin: 60, locationType: "SALON", stylistIds: ["a", "b"], busy, now: NOW });
  const at10 = slots.find((s) => s.startMin === 600)!;
  assert.deepEqual(at10.stylistIds, ["b"]);
  const at930 = slots.find((s) => s.startMin === 570)!;
  assert.deepEqual(at930.stylistIds, ["b"]);
  const at11 = slots.find((s) => s.startMin === 660)!;
  assert.deepEqual(at11.stylistIds, ["a", "b"]);
});

test("home visits keep a travel buffer", () => {
  const busy = [{ stylistId: "a", startMin: 600, endMin: 660, locationType: "HOME" }];
  const slots = computeSlots({ date: "2026-11-19", durationMin: 60, locationType: "SALON", stylistIds: ["a"], busy, now: NOW });
  assert.ok(!slots.some((s) => s.startMin === 660)); // 11:00 blocked by 30 min travel
  assert.ok(slots.some((s) => s.startMin === 690)); // 11:30 ok
});

test("staff time off blocks that stylist only", () => {
  const busy = [{ stylistId: "a", startMin: 0, endMin: 1440, locationType: "SALON" }]; // a is off all day
  const slots = computeSlots({ date: "2026-11-19", durationMin: 60, locationType: "SALON", stylistIds: ["a", "b"], busy, now: NOW });
  assert.ok(slots.length > 0);
  assert.ok(slots.every((s) => s.stylistIds.length === 1 && s.stylistIds[0] === "b"));
});

test("walk-ins: staff can book today without the 2-hour notice", () => {
  const slots = computeSlots({ date: "2026-11-18", durationMin: 30, locationType: "SALON", stylistIds: ["a"], busy: [], now: NOW, minNoticeMin: 0 });
  assert.equal(slots[0].startMin, 9 * 60);
});

test("minutesUntil", () => {
  assert.equal(minutesUntil("2026-11-19", 8 * 60, NOW), 1440);
});
