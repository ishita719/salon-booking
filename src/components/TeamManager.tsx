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

interface Request {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

const EMPTY = { name: "", title: "", bio: "", email: "", phone: "", password: "", workDays: [2, 3, 4, 5, 6] };

export default function TeamManager() {
  const [team, setTeam] = useState<Member[]>([]);
  const [adding, setAdding] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<(Member & { newPassword: string }) | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [requests, setRequests] = useState<Request[]>([]);
  const [approving, setApproving] = useState<{ id: string; title: string; workDays: number[] } | null>(null);

  const load = useCallback(async () => {
    const [r, q] = await Promise.all([api<{ team: Member[] }>("/api/team"), api<{ requests: Request[] }>("/api/team/requests")]);
    setTeam(r.team);
    setRequests(q.requests);
  }, []);

  async function decide(req: Request, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm(`Reject ${req.name}'s staff request? Their sign-up will be removed.`)) return;
    try {
      const body = action === "approve" && approving?.id === req.id ? { action, title: approving.title || undefined, workDays: approving.workDays } : { action };
      await api(`/api/team/requests/${req.id}`, { method: "PATCH", body });
      setFlash({ kind: "ok", text: action === "approve" ? `${req.name} approved — they can now log in as staff.` : `${req.name}'s request was rejected.` });
      setApproving(null);
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

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
          <h1>Team</h1>
          <p className="muted">Add staff logins, set working days and manage time off.</p>
        </div>
        <button className="btn" onClick={() => { setAdding({ ...EMPTY }); setEditing(null); }}>Add team member</button>
      </div>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}

      {requests.length > 0 && (
        <section className="card" style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
          <h2>Staff sign-up requests <span className="badge badge-NO_SHOW">{requests.length}</span></h2>
          <p className="muted small">These people chose &quot;Staff&quot; when creating an account. They can&apos;t log in until you approve them.</p>
          {requests.map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
              <div className="spread">
                <div>
                  <strong>{r.name}</strong>
                  <div className="small muted">{r.email} · {r.phone} · requested {new Date(r.createdAt).toLocaleDateString("en-CA")}</div>
                </div>
                <div className="row">
                  {approving?.id !== r.id ? (
                    <button className="btn btn-sm" onClick={() => setApproving({ id: r.id, title: "Stylist", workDays: [2, 3, 4, 5, 6] })}>Approve…</button>
                  ) : (
                    <button className="btn btn-sm" onClick={() => decide(r, "approve")}>Confirm approval</button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => decide(r, "reject")}>Reject</button>
                </div>
              </div>
              {approving?.id === r.id && (
                <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
                  <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
                    <label htmlFor={`ap-title-${r.id}`}>Job title</label>
                    <input id={`ap-title-${r.id}`} type="text" maxLength={60} value={approving.title} onChange={(e) => setApproving({ ...approving, title: e.target.value })} />
                  </div>
                  <div>
                    <label>Working days</label>
                    <WeekdayPicker value={approving.workDays} onChange={(v) => setApproving({ ...approving, workDays: v })} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

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
