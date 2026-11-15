"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/AppointmentCard";
import type { AppointmentDTO } from "@/lib/bookings";
import { api } from "@/lib/client";

interface Client {
  key: string;
  clientId: string | null;
  guestPhone: string | null;
  name: string;
  email: string | null;
  phone: string;
  registered: boolean;
  visits: number;
  upcoming: number;
  noShows: number;
  cancellations: number;
  spentLabel: string;
  lastVisitLabel: string;
}

export default function ClientsList() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<Client[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [history, setHistory] = useState<AppointmentDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ clients: Client[]; total: number }>(`/api/clients?q=${encodeURIComponent(q)}`)
        .then((r) => {
          setClients(r.clients);
          setTotal(r.total);
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function toggle(c: Client) {
    if (open === c.key) return setOpen(null);
    setOpen(c.key);
    setHistory([]);
    const qs = c.clientId ? `clientId=${c.clientId}` : `guestPhone=${encodeURIComponent(c.guestPhone ?? "")}`;
    try {
      const r = await api<{ appointments: AppointmentDTO[] }>(`/api/appointments?${qs}`);
      setHistory(r.appointments.reverse());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="container section">
      <h1>Clients</h1>
      <p className="muted">{total} clients — registered accounts and walk-ins booked by the salon.</p>
      <input type="text" placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 420, marginBottom: 16 }} aria-label="Search clients" />
      {error && <div className="alert alert-error">{error}</div>}
      {clients === null ? (
        <p className="muted">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="card center muted">No clients found.</div>
      ) : (
        <div className="card table-wrap" style={{ padding: 8 }}>
          <table>
            <thead><tr><th>Client</th><th>Contact</th><th>Visits</th><th>Upcoming</th><th>Spent</th><th>Last visit</th><th>No-shows</th><th></th></tr></thead>
            <tbody>
              {clients.flatMap((c) => {
                const rows = [
                  <tr key={c.key}>
                    <td><strong>{c.name}</strong>{!c.registered && <span className="badge badge-COMPLETED" style={{ marginLeft: 6 }}>walk-in</span>}</td>
                    <td className="small">
                      {c.phone && <div><a href={`tel:${c.phone}`}>{c.phone}</a></div>}
                      {c.email && <div><a href={`mailto:${c.email}`}>{c.email}</a></div>}
                    </td>
                    <td>{c.visits}</td>
                    <td>{c.upcoming}</td>
                    <td>{c.spentLabel}</td>
                    <td className="small">{c.lastVisitLabel}</td>
                    <td>{c.noShows ? <span className="badge badge-NO_SHOW">{c.noShows}</span> : 0}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{open === c.key ? "Hide" : "History"}</button></td>
                  </tr>,
                ];
                if (open === c.key)
                  rows.push(
                    <tr key={`${c.key}-h`}>
                      <td colSpan={8} style={{ background: "var(--surface-2)" }}>
                        {history.length === 0 ? (
                          <span className="muted small">Loading…</span>
                        ) : (
                          history.map((a) => (
                            <div key={a.id} className="spread small" style={{ padding: "4px 0" }}>
                              <span>{a.dateLabel}, {a.timeLabel} · {a.items.map((i) => i.name).join(", ")} · {a.stylist?.name ?? "—"}</span>
                              <span>{a.totalLabel} <StatusBadge status={a.status} /></span>
                            </div>
                          ))
                        )}
                      </td>
                    </tr>,
                  );
                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
