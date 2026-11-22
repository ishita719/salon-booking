"use client";

import { TARGET_KEYS, TARGETS } from "@/lib/skin";

/** Tick which skin/hair needs a service or product is good for — this drives the skin-check recommendations. */
export default function TargetPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="weekdays">
      {TARGET_KEYS.map((k) => (
        <label key={k} title={TARGETS[k]}>
          <input type="checkbox" checked={value.includes(k)} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
          {TARGETS[k]}
        </label>
      ))}
    </div>
  );
}
