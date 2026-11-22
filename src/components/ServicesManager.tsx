"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TargetPicker from "@/components/TargetPicker";
import { api } from "@/lib/client";
import { formatDuration, formatMoney } from "@/lib/time";

interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
  durationMin: number;
  priceCents: number;
  homeAvailable: boolean;
  active: boolean;
  targets: string; // comma list — what it's good for (skin check)
  steps: string; // how it's done, one step per line
}

const EMPTY: Omit<Service, "id"> = { name: "", category: "Hair", description: "", durationMin: 60, priceCents: 5000, homeAvailable: true, active: true, targets: "", steps: "" };

export default function ServicesManager() {
  const [list, setList] = useState<Service[]>([]);
  const [editing, setEditing] = useState<(Omit<Service, "id"> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ services: Service[] }>("/api/services?all=1");
    setList(r.services);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const { id, ...body } = editing;
    try {
      await api(id ? `/api/services/${id}` : "/api/services", { method: id ? "PATCH" : "POST", body: { ...body, targets: body.targets.split(",").filter(Boolean) } });
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(s: Service) {
    if (!window.confirm(`Remove "${s.name}"? Services with past bookings are hidden instead of deleted.`)) return;
    try {
      await api(`/api/services/${s.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const set = <K extends keyof Service>(k: K, v: Service[K]) => setEditing((cur) => (cur ? { ...cur, [k]: v } : cur));

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      <div className="spread">
        <div>
          <h1>Services &amp; prices</h1>
          <p className="muted">Changes show on the website immediately. Existing bookings keep the price they were booked at.</p>
        </div>
        <button className="btn" onClick={() => setEditing({ ...EMPTY })}>Add service</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {editing && (
        <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
          <h2>{editing.id ? "Edit service" : "New service"}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" type="text" required value={editing.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="field"><label htmlFor="s-cat">Category</label><input id="s-cat" type="text" required value={editing.category} onChange={(e) => set("category", e.target.value)} /></div>
            <div className="field"><label htmlFor="s-dur">Duration (minutes)</label><input id="s-dur" type="number" min={15} max={480} step={15} required value={editing.durationMin} onChange={(e) => set("durationMin", Number(e.target.value))} /></div>
            <div className="field"><label htmlFor="s-price">Price (CAD)</label><input id="s-price" type="number" min={0} step={0.01} required value={editing.priceCents / 100} onChange={(e) => set("priceCents", Math.round(Number(e.target.value) * 100))} /></div>
          </div>
          <div className="field"><label htmlFor="s-desc">Description</label><textarea id="s-desc" maxLength={300} value={editing.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="field">
            <label>Good for (used by the online skin check to recommend this service)</label>
            <TargetPicker value={editing.targets.split(",").filter(Boolean)} onChange={(t) => set("targets", t.join(","))} />
          </div>
          <div className="field">
            <label htmlFor="s-steps">How it&apos;s done — one step per line (shown to clients)</label>
            <textarea id="s-steps" maxLength={2000} rows={5} value={editing.steps} onChange={(e) => set("steps", e.target.value)} placeholder={"Consultation\nWash and condition\nCut\nStyle and finish"} />
          </div>
          <div className="row" style={{ marginBottom: 16 }}>
            <label className="choice" style={{ padding: 10 }}><input type="checkbox" checked={editing.homeAvailable} onChange={(e) => set("homeAvailable", e.target.checked)} /> Available at home</label>
            <label className="choice" style={{ padding: 10 }}><input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} /> Visible to clients</label>
          </div>
          <div className="row">
            <button className="btn">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead>
            <tr><th>Service</th><th>Category</th><th>Duration</th><th>Price</th><th>At home</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                <td><strong>{s.name}</strong><div className="small muted">{s.description}</div></td>
                <td>{s.category}</td>
                <td>{formatDuration(s.durationMin)}</td>
                <td>{formatMoney(s.priceCents)}</td>
                <td>{s.homeAvailable ? "Yes" : "No"}</td>
                <td>{s.active ? "Visible" : "Hidden"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...s })}>Edit</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
