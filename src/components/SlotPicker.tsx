"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Props {
  minDate: string;
  maxDate: string;
  durationMin: number;
  location: "SALON" | "HOME";
  stylistId: string;
  excludeId?: string;
  date: string;
  startMin: number | null;
  onChange: (date: string, startMin: number | null) => void;
}

/** Date input + grid of free start times fetched from /api/availability. */
export default function SlotPicker(p: Props) {
  const [slots, setSlots] = useState<{ startMin: number; label: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!p.date || p.durationMin <= 0) {
      setSlots([]);
      setMessage(p.durationMin <= 0 ? "Choose a service first to see times." : null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ date: p.date, duration: String(p.durationMin), location: p.location });
    if (p.stylistId) qs.set("stylistId", p.stylistId);
    if (p.excludeId) qs.set("excludeId", p.excludeId);
    api<{ slots: { startMin: number; label: string }[]; message: string | null }>(`/api/availability?${qs}`)
      .then((r) => {
        if (cancelled) return;
        setSlots(r.slots);
        setMessage(r.message);
        if (p.startMin != null && !r.slots.some((s) => s.startMin === p.startMin)) p.onChange(p.date, null);
      })
      .catch((e) => !cancelled && setMessage(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.date, p.durationMin, p.location, p.stylistId, p.excludeId]);

  return (
    <div>
      <div className="field" style={{ maxWidth: 240 }}>
        <label htmlFor="date">Date</label>
        <input id="date" type="date" min={p.minDate} max={p.maxDate} value={p.date} onChange={(e) => p.onChange(e.target.value, null)} />
      </div>
      {loading && <p className="muted small">Checking availability…</p>}
      {!loading && message && <p className="muted small">{message}</p>}
      {!loading && slots.length > 0 && (
        <div className="slots" role="listbox" aria-label="Available times">
          {slots.map((s) => (
            <button
              type="button"
              key={s.startMin}
              role="option"
              aria-selected={p.startMin === s.startMin}
              className={`slot ${p.startMin === s.startMin ? "selected" : ""}`}
              onClick={() => p.onChange(p.date, s.startMin)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
