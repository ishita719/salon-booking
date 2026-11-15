"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SlotPicker from "@/components/SlotPicker";
import type { AppointmentDTO } from "@/lib/bookings";
import { api } from "@/lib/client";
import { formatDate, formatTime } from "@/lib/time";

interface Props {
  id: string;
  stylists: { id: string; name: string; title: string }[];
  minDate: string;
  maxDate: string;
  backHref?: string;
  asTeam?: boolean; // staff/owner: no 12-hour cutoff
}

export default function RescheduleView({ id, stylists, minDate, maxDate, backHref = "/account", asTeam: asAdmin = false }: Props) {
  const router = useRouter();
  const [a, setA] = useState<AppointmentDTO | null>(null);
  const [stylistId, setStylistId] = useState("");
  const [date, setDate] = useState("");
  const [startMin, setStartMin] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ appointment: AppointmentDTO }>(`/api/appointments/${id}`)
      .then((r) => {
        setA(r.appointment);
        setStylistId(r.appointment.stylist?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function save() {
    if (!date || startMin == null) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/appointments/${id}`, { method: "PATCH", body: { action: "reschedule", date, startMin, stylistId: stylistId || null } });
      router.push(backHref === "/account" ? "/account?rescheduled=1" : backHref);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <Link href={backHref} className="small">← Back</Link>
      <h1 style={{ marginTop: 12 }}>Reschedule</h1>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {!a ? (
        !error && <p className="muted">Loading…</p>
      ) : asAdmin ? (a.status !== "BOOKED" && a.status !== "CONFIRMED") : !a.canChange ? (
        <div className="alert alert-info">
          {asAdmin ? "Only active (booked/confirmed) appointments can be rescheduled." : "This appointment can no longer be changed online. Please call the salon."}
        </div>
      ) : (
        <div className="card">
          <p>
            Currently: <strong>{a.dateLabel}, {a.timeLabel}</strong>
            <br />
            <span className="muted small">{a.items.map((i) => i.name).join(", ")} · {a.locationType === "HOME" ? "At home" : "In studio"}</span>
          </p>
          <div className="field" style={{ maxWidth: 320 }}>
            <label htmlFor="stylist">Stylist</label>
            <select id="stylist" value={stylistId} onChange={(e) => { setStylistId(e.target.value); setStartMin(null); }}>
              <option value="">Any available stylist</option>
              {stylists.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.title}</option>)}
            </select>
          </div>
          <SlotPicker
            minDate={minDate}
            maxDate={maxDate}
            durationMin={a.endMin - a.startMin}
            location={a.locationType === "HOME" ? "HOME" : "SALON"}
            stylistId={stylistId}
            excludeId={a.id}
            date={date}
            startMin={startMin}
            onChange={(d, s) => { setDate(d); setStartMin(s); }}
          />
          <div className="row" style={{ marginTop: 20 }}>
            <button className="btn" disabled={busy || !date || startMin == null} onClick={save}>
              {busy ? "Saving…" : date && startMin != null ? `Move to ${formatDate(date)}, ${formatTime(startMin)}` : "Pick a new time"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
