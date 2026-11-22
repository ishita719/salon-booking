"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/AppointmentCard";
import type { AppointmentDTO } from "@/lib/bookings";
import { api } from "@/lib/client";
import { addDays, formatDate } from "@/lib/time";

const STATUSES = ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

interface Props {
  today: string;
  stylists: { id: string; name: string }[];
}

/** Owner view of every appointment: by day / upcoming / date range, filter by stylist and status. */
export default function AppointmentsBoard({ today, stylists }: Props) {
  const [mode, setMode] = useState<"day" | "upcoming" | "history">("day");
  const [date, setDate] = useState(today);
  const [stylistId, setStylistId] = useState("");
  const [status, setStatus] = useState("");
  const [list, setList] = useState<AppointmentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams();
    if (mode === "day") qs.set("date", date);
    else if (mode === "upcoming") qs.set("upcoming", "1");
    else {
      qs.set("from", addDays(today, -60));
      qs.set("to", addDays(today, -1));
    }
    if (stylistId) qs.set("stylistId", stylistId);
    if (status && mode !== "upcoming") qs.set("status", status);
    try {
      const r = await api<{ appointments: AppointmentDTO[] }>(`/api/appointments?${qs}`);
      setList(mode === "history" ? r.appointments.reverse() : r.appointments);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [mode, date, stylistId, status, today]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(id: string, s: string) {
    try {
      await api(`/api/appointments/${id}`, { method: "PATCH", body: { action: "status", status: s } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function recordPayment(a: AppointmentDTO, paymentStatus: "PAID_IN_SALON" | "UNPAID" | "REFUNDED") {
    const msg = paymentStatus === "REFUNDED" ? "Mark this payment as refunded? (Refund the money in Stripe or at the till first.)" : null;
    if (msg && !window.confirm(msg)) return;
    try {
      await api(`/api/appointments/${a.id}`, { method: "PATCH", body: { action: "payment", paymentStatus } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Permanently delete this appointment? This can't be undone. (Tip: use Cancelled to keep a record.)")) return;
    try {
      await api(`/api/appointments/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const active = (list ?? []).filter((a) => a.isActive);
  const value = (list ?? []).filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW").reduce((t, a) => t + a.totalCents, 0);

  return (
    <div className="container section">
      <div className="spread">
        <h1>Appointments</h1>
        <Link href="/book" className="btn">New booking</Link>
      </div>

      <div className="tabs">
        <button className={mode === "day" ? "active" : ""} onClick={() => setMode("day")}>By day</button>
        <button className={mode === "upcoming" ? "active" : ""} onClick={() => setMode("upcoming")}>Upcoming</button>
        <button className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>Last 60 days</button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {mode === "day" && (
          <div className="daynav">
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">←</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: "auto" }} aria-label="Day" />
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">→</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDate(today)}>Today</button>
          </div>
        )}
        <select value={stylistId} onChange={(e) => setStylistId(e.target.value)} style={{ width: "auto" }} aria-label="Stylist">
          <option value="">All stylists</option>
          {stylists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {mode !== "upcoming" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }} aria-label="Status">
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </select>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 20 }}>
        <div className="card-flat"><div className="muted small">{mode === "day" ? formatDate(date) : "Showing"}</div><div className="stat">{list?.length ?? "–"}</div></div>
        <div className="card-flat"><div className="muted small">Active bookings</div><div className="stat">{active.length}</div></div>
        <div className="card-flat"><div className="muted small">At-home visits</div><div className="stat">{active.filter((a) => a.locationType === "HOME").length}</div></div>
        <div className="card-flat"><div className="muted small">Value</div><div className="stat">{new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value / 100)}</div></div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {list === null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <div className="card center muted">No appointments.</div>
      ) : (
        <div className="card table-wrap" style={{ padding: 8 }}>
          <table>
            <thead>
              <tr><th>When</th><th>Client</th><th>Services</th><th>Where / stylist</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {mode !== "day" && <div className="small muted">{a.dateLabel}</div>}
                    {a.timeLabel}
                    <div className="small muted">{a.source === "STAFF" ? "Booked by salon" : "Booked online"}</div>
                  </td>
                  <td>
                    <strong>{a.customer.name}</strong>
                    {!a.customer.registered && <span className="badge badge-COMPLETED" style={{ marginLeft: 6 }}>walk-in</span>}
                    {a.customer.phone && <div className="small"><a href={`tel:${a.customer.phone}`}>{a.customer.phone}</a></div>}
                    {a.customer.email && <div className="small"><a href={`mailto:${a.customer.email}`}>{a.customer.email}</a></div>}
                  </td>
                  <td>
                    {a.items.map((i) => (
                      <div key={i.id}>{i.name}{i.isCustom && <span className="badge badge-NO_SHOW" style={{ marginLeft: 6 }}>custom</span>}</div>
                    ))}
                    <div className="small muted">{a.totalLabel}</div>
                    {a.offerTitle && <div className="small" style={{ color: "var(--gold)" }}>{a.discountLabel} · {a.offerTitle}</div>}
                    <div style={{ marginTop: 4 }}>
                      <span className={`tag ${a.paymentStatus.startsWith("PAID") ? "tag-ok" : ""}`}>{a.paymentLabel}{a.paidLabel ? ` · ${a.paidLabel}` : ""}</span>
                    </div>
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      {(a.paymentStatus === "UNPAID" || a.paymentStatus === "PENDING") && a.status !== "CANCELLED" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => recordPayment(a, "PAID_IN_SALON")}>Mark paid</button>
                      )}
                      {(a.paymentStatus === "PAID_ONLINE" || a.paymentStatus === "PAID_IN_SALON") && (
                        <button className="btn btn-sm btn-ghost" onClick={() => recordPayment(a, "REFUNDED")}>Refunded</button>
                      )}
                    </div>
                    {a.notes && <div className="small muted">“{a.notes}”</div>}
                  </td>
                  <td>
                    {a.locationType === "HOME" ? (<><strong>At home</strong><div className="small">{a.address}, {a.postalCode}</div></>) : "Studio"}
                    <div className="small muted">{a.stylist?.name ?? "Unassigned"}</div>
                  </td>
                  <td>
                    <StatusBadge status={a.status} />
                    <select aria-label="Change status" value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)} style={{ marginTop: 6, padding: "4px 6px", fontSize: "0.85rem" }}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {a.isActive && <Link href={`/owner/appointments/${a.id}`} className="btn btn-ghost btn-sm">Move</Link>}{" "}
                    <button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
