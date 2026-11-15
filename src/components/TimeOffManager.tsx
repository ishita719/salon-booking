"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Entry {
  id: string;
  stylistId: string;
  stylistName: string;
  reason: string;
  label: string;
}

interface Props {
  stylists?: { id: string; name: string }[]; // owner: choose whose time off. Staff: omitted (always their own).
  minDate?: string;
  embedded?: boolean;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Add/remove blocked time. Booked appointments in that window must be moved first (enforced by the API). */
export default function TimeOffManager({ stylists, minDate, embedded }: Props) {
  const [list, setList] = useState<Entry[]>([]);
  const [stylistId, setStylistId] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("14:00");
  const [reason, setReason] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ timeOff: Entry[] }>("/api/time-off");
    setList(r.timeOff);
  }, []);

  useEffect(() => {
    load().catch((e) => setFlash({ kind: "error", text: e.message }));
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setFlash(null);
    try {
      await api("/api/time-off", {
        method: "POST",
        body: { stylistId: stylists ? stylistId : undefined, date, allDay, startMin: toMin(start), endMin: toMin(end), reason },
      });
      setFlash({ kind: "ok", text: "Time off saved — clients can't book that time." });
      setReason("");
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/time-off/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  const body = (
    <>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}
      <div className="dash-cols">
        <form className="card" onSubmit={add}>
          <h3>Block time</h3>
          {stylists && (
            <div className="field">
              <label htmlFor="to-who">Team member</label>
              <select id="to-who" required value={stylistId} onChange={(e) => setStylistId(e.target.value)}>
                <option value="">Choose…</option>
                {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ maxWidth: 220 }}>
            <label htmlFor="to-date">Date</label>
            <input id="to-date" type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <label className="choice" style={{ padding: 10, marginBottom: 12, display: "inline-flex" }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All day
          </label>
          {!allDay && (
            <div className="row" style={{ marginBottom: 16 }}>
              <div><label htmlFor="to-start">From</label><input id="to-start" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><label htmlFor="to-end">To</label><input id="to-end" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
          )}
          <div className="field">
            <label htmlFor="to-reason">Reason (optional, not shown to clients)</label>
            <input id="to-reason" type="text" maxLength={120} placeholder="Vacation, doctor, training…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn">Save time off</button>
        </form>

        <div className="card">
          <h3>Upcoming time off</h3>
          {list.length === 0 ? (
            <p className="muted">Nothing scheduled.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {list.map((o) => (
                <li key={o.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <div>
                    {stylists && <strong>{o.stylistName} · </strong>}
                    {o.label}
                    {o.reason && <div className="small muted">{o.reason}</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(o.id)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) return body;
  return (
    <div className="container section">
      <h1>Time off</h1>
      <p className="muted">Block days or hours you&apos;re not available. Clients won&apos;t be able to book you then.</p>
      {body}
    </div>
  );
}
