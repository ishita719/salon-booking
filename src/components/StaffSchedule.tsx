"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/AppointmentCard";
import type { AppointmentDTO } from "@/lib/bookings";
import { api } from "@/lib/client";
import { addDays, formatDate } from "@/lib/time";

interface Props {
  name: string;
  today: string;
  worksToday: boolean;
}

/** A stylist's own schedule: their appointments only, with the client details they need for the visit. */
export default function StaffSchedule({ name, today, worksToday }: Props) {
  const [mode, setMode] = useState<"day" | "upcoming">("day");
  const [date, setDate] = useState(today);
  const [list, setList] = useState<AppointmentDTO[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const qs = mode === "day" ? `date=${date}` : "upcoming=1";
    try {
      const r = await api<{ appointments: AppointmentDTO[] }>(`/api/appointments?${qs}`);
      setList(r.appointments);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mode, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(a: AppointmentDTO, body: object, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(a.id);
    try {
      await api(`/api/appointments/${a.id}`, { method: "PATCH", body });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const shown = (list ?? []).filter((a) => mode === "upcoming" || a.status !== "CANCELLED");
  const done = shown.filter((a) => a.status === "COMPLETED").length;
  const remaining = shown.filter((a) => a.isActive).length;

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <div className="eyebrow">Staff · My schedule</div>
          <h1>Hi, {name.split(" ")[0]}</h1>
          <p className="muted">{formatDate(today)}{worksToday ? "" : " — you're not scheduled to work today."}</p>
        </div>
        <div className="row">
          <Link href="/staff/time-off" className="btn btn-ghost">Request time off</Link>
          <Link href="/book" className="btn">Book a client</Link>
        </div>
      </div>

      <div className="tabs">
        <button className={mode === "day" ? "active" : ""} onClick={() => setMode("day")}>Day</button>
        <button className={mode === "upcoming" ? "active" : ""} onClick={() => setMode("upcoming")}>All upcoming</button>
      </div>

      {mode === "day" && (
        <div className="spread" style={{ marginBottom: 16 }}>
          <div className="daynav">
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">←</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label="Day" />
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">→</button>
            {date !== today && <button className="btn btn-ghost btn-sm" onClick={() => setDate(today)}>Today</button>}
          </div>
          <div className="small muted">{remaining} to go · {done} done</div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card center muted">{mode === "day" ? `No appointments on ${formatDate(date)}.` : "No upcoming appointments."}</div>
      ) : (
        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {shown.map((a) => (
            <div key={a.id} className="appt-row">
              <div>
                {mode === "upcoming" && <div className="small muted">{a.dateLabel}</div>}
                <strong>{a.timeLabel.split(" – ")[0]}</strong>
                <div className="small muted">to {a.timeLabel.split(" – ")[1]}</div>
              </div>
              <div>
                <div>
                  <strong>{a.customer.name}</strong>{" "}
                  {a.customer.phone && <a className="small" href={`tel:${a.customer.phone}`}>{a.customer.phone}</a>}
                </div>
                <div>{a.items.map((i) => i.name).join(" + ")}</div>
                {a.locationType === "HOME" ? (
                  <div className="small">
                    <strong>Home visit:</strong> {a.address}, {a.postalCode} ·{" "}
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.address} ${a.postalCode}`)}`} target="_blank" rel="noopener noreferrer">Directions</a>
                  </div>
                ) : (
                  <div className="small muted">In studio</div>
                )}
                {a.notes && <div className="small" style={{ marginTop: 4, background: "var(--warn-soft)", padding: "4px 8px", borderRadius: 6 }}>Note: {a.notes}</div>}
                <div className="small muted" style={{ marginTop: 4 }}>{a.totalLabel}</div>
              </div>
              <div className="stack" style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: 6 }}>
                <StatusBadge status={a.status} />
                {a.isActive && (
                  <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                    {a.status === "BOOKED" && <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => act(a, { action: "status", status: "CONFIRMED" })}>Confirm</button>}
                    <button className="btn btn-sm" disabled={busyId === a.id} onClick={() => act(a, { action: "status", status: "COMPLETED" })}>Done</button>
                    <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => act(a, { action: "status", status: "NO_SHOW" }, "Mark as no-show?")}>No-show</button>
                    <Link className="btn btn-ghost btn-sm" href={`/staff/appointments/${a.id}`}>Move</Link>
                    <button className="btn btn-danger btn-sm" disabled={busyId === a.id} onClick={() => act(a, { action: "cancel" }, "Cancel this appointment? The client will be emailed.")}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
