"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TimeOffManager from "@/components/TimeOffManager";
import { api } from "@/lib/client";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Member {
  id: string;
  name: string;
  title: string;
  bio: string;
  active: boolean;
  workDays: number[];
  email: string | null;
  phone: string | null;
  hasLogin: boolean;
  upcoming: number;
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="weekdays">
      {DAY_NAMES.map((d, i) => (
        <label key={d}>
          <input type="checkbox" checked={value.includes(i)} onChange={(e) => onChange(e.target.checked ? [...value, i] : value.filter((x) => x !== i))} />
          {d}
        </label>
      ))}
    </div>
  );
}

/** Owner sets the code staff need to create an account and to log in (every time). */
function StaffCodePanel() {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ code: string | null }>("/api/team/code").then((r) => setCode(r.code)).catch((e) => setMsg({ kind: "error", text: e.message }));
  }, []);

  async function save(body: { generate?: boolean; code?: string }) {
    if (code && !window.confirm("Change the staff code? Every staff member will be logged out and will need the NEW code to log in.")) return;
    try {
      const r = await api<{ code: string }>("/api/team/code", { method: "PUT", body });
      setCode(r.code);
      setCustom("");
      setMsg({ kind: "ok", text: "Staff code saved. Share it privately with your team (in person or by text)." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <section className="card" style={{ marginBottom: 24 }}>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Staff code</h2>
          <p className="muted small" style={{ maxWidth: 560 }}>
            Staff need this code to <strong>create their account</strong> and <strong>every time they log in</strong> at the Team login.
            Changing it logs every staff member out — useful when someone leaves.
          </p>
        </div>
      </div>
      {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
      {code === undefined ? (
        <p className="muted">Loading…</p>
      ) : code ? (
        <div className="code-box">
          <span className="code">{code}</span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => save({ generate: true })}>Generate new code</button>
        </div>
      ) : (
        <div className="alert alert-gold spread">
          <span>No staff code yet — staff can&apos;t join or log in until you set one.</span>
          <button type="button" className="btn btn-sm btn-gold" onClick={() => save({ generate: true })}>Generate a code</button>
        </div>
      )}
      <form
        className="row"
        style={{ marginTop: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          save({ code: custom });
        }}
      >
        <input type="text" className="code-input" style={{ maxWidth: 260 }} placeholder="Or type your own code" value={custom} onChange={(e) => setCustom(e.target.value)} minLength={6} maxLength={32} aria-label="Custom staff code" />
        <button className="btn btn-ghost btn-sm" disabled={custom.trim().length < 6}>Use this code</button>
      </form>
      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
        New staff join at <strong>/team/join</strong>. You can also add someone yourself with &quot;Add team member&quot; below.
      </p>
    </section>
  );
}

const EMPTY = { name: "", title: "", bio: "", email: "", phone: "", password: "", workDays: [2, 3, 4, 5, 6] };

export default function TeamManager() {
  const [team, setTeam] = useState<Member[]>([]);
  const [adding, setAdding] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<(Member & { newPassword: string }) | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ team: Member[] }>("/api/team");
    setTeam(r.team);
  }, []);

  useEffect(() => {
    load().catch((e) => setFlash({ kind: "error", text: e.message }));
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!adding) return;
    try {
      await api("/api/team", { method: "POST", body: adding });
      setFlash({ kind: "ok", text: `${adding.name} added. They can now log in with ${adding.email} and the password you set.` });
      setAdding(null);
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const { id, name, title, bio, phone, workDays, active, newPassword } = editing;
    try {
      await api(`/api/team/${id}`, {
        method: "PATCH",
        body: { name, title, bio, workDays, active, ...(phone ? { phone } : {}), ...(newPassword ? { newPassword } : {}) },
      });
      setFlash({ kind: "ok", text: `${name} updated.${newPassword ? " New password set." : ""}` });
      setEditing(null);
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  async function toggleActive(m: Member) {
    const msg = m.active
      ? `Deactivate ${m.name}? They won't be able to log in or receive new bookings.${m.upcoming ? ` They still have ${m.upcoming} upcoming appointment(s) — move those first.` : ""}`
      : `Reactivate ${m.name}?`;
    if (!window.confirm(msg)) return;
    try {
      await api(`/api/team/${m.id}`, { method: "PATCH", body: { active: !m.active } });
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <div className="eyebrow">Owner</div>
          <h1>Team</h1>
          <p className="muted">Set the staff code, add team members, set working days and manage time off.</p>
        </div>
        <button className="btn" onClick={() => { setAdding({ ...EMPTY }); setEditing(null); }}>Add team member</button>
      </div>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}

      <StaffCodePanel />

      {adding && (
        <form className="card" onSubmit={create} style={{ marginBottom: 20 }}>
          <h2>New team member</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="field"><label htmlFor="t-name">Full name</label><input id="t-name" type="text" required value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="t-title">Job title</label><input id="t-title" type="text" required placeholder="e.g. Stylist" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></div>
            <div className="field"><label htmlFor="t-email">Login email</label><input id="t-email" type="email" required value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="t-phone">Phone</label><input id="t-phone" type="tel" required value={adding.phone} onChange={(e) => setAdding({ ...adding, phone: e.target.value })} /></div>
            <div className="field">
              <label htmlFor="t-pw">Temporary password</label>
              <input id="t-pw" type="password" required minLength={8} autoComplete="new-password" value={adding.password} onChange={(e) => setAdding({ ...adding, password: e.target.value })} />
              <div className="hint">Share it privately; they can change it in Settings.</div>
            </div>
          </div>
          <div className="field"><label htmlFor="t-bio">Short bio (shown to clients)</label><textarea id="t-bio" maxLength={300} value={adding.bio} onChange={(e) => setAdding({ ...adding, bio: e.target.value })} /></div>
          <div className="field"><label>Working days</label><WeekdayPicker value={adding.workDays} onChange={(v) => setAdding({ ...adding, workDays: v })} /></div>
          <div className="row">
            <button className="btn">Create login</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
          </div>
        </form>
      )}

      {editing && (
        <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
          <h2>Edit {editing.name}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="field"><label htmlFor="e-name">Full name</label><input id="e-name" type="text" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="e-title">Job title</label><input id="e-title" type="text" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            {editing.hasLogin && (
              <>
                <div className="field"><label htmlFor="e-phone">Phone</label><input id="e-phone" type="tel" value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="field">
                  <label htmlFor="e-pw">Reset password</label>
                  <input id="e-pw" type="password" autoComplete="new-password" placeholder="Leave empty to keep" value={editing.newPassword} onChange={(e) => setEditing({ ...editing, newPassword: e.target.value })} />
                </div>
              </>
            )}
          </div>
          <div className="field"><label htmlFor="e-bio">Short bio</label><textarea id="e-bio" maxLength={300} value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
          <div className="field"><label>Working days</label><WeekdayPicker value={editing.workDays} onChange={(v) => setEditing({ ...editing, workDays: v })} /></div>
          <div className="row">
            <button className="btn">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr><th>Name</th><th>Login</th><th>Works</th><th>Upcoming</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
                <td><strong>{m.name}</strong><div className="small muted">{m.title}</div></td>
                <td className="small">{m.email ?? <span className="muted">No login</span>}<div className="muted">{m.phone}</div></td>
                <td className="small">{m.workDays.map((d) => DAY_NAMES[d]).join(", ") || "—"}</td>
                <td>{m.upcoming}</td>
                <td>{m.active ? <span className="badge badge-CONFIRMED">Active</span> : <span className="badge badge-CANCELLED">Inactive</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing({ ...m, newPassword: "" }); setAdding(null); }}>Edit</button>{" "}
                  <button className={`btn btn-sm ${m.active ? "btn-danger" : "btn-ghost"}`} onClick={() => toggleActive(m)}>{m.active ? "Deactivate" : "Reactivate"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginTop: 40 }}>Time off</h2>
      <TimeOffManager stylists={team.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }))} embedded />
    </div>
  );
}
