"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppointmentCard from "@/components/AppointmentCard";
import SettingsView from "@/components/SettingsView";
import type { AppointmentDTO } from "@/lib/bookings";
import { api } from "@/lib/client";

type User = { name: string; email: string; phone: string };

export default function AccountView({ payOnline = false }: { payOnline?: boolean }) {
  const [tab, setTab] = useState<"upcoming" | "past" | "profile">("upcoming");
  const [list, setList] = useState<AppointmentDTO[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, u] = await Promise.all([
      api<{ appointments: AppointmentDTO[] }>("/api/appointments"),
      api<{ user: User }>("/api/me"),
    ]);
    setList(a.appointments);
    setUser(u.user);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("booked")) setFlash({ kind: "ok", text: "You're booked! A confirmation has been sent to your email." });
    if (params.get("rescheduled")) setFlash({ kind: "ok", text: "Your appointment has been rescheduled." });
    if (params.get("paid")) setFlash({ kind: "ok", text: "Payment received — thank you! Your appointment is paid." });
    if (params.get("payment") === "cancelled") setFlash({ kind: "error", text: "Payment was cancelled. Your booking is still saved — you can pay now or at the salon." });
    if (params.get("payment") === "pending") setFlash({ kind: "error", text: "We couldn't confirm the payment yet. If you were charged, it will show here shortly." });
    if (params.size) window.history.replaceState(null, "", "/account/appointments");
    load().catch((e) => setFlash({ kind: "error", text: e.message }));
  }, [load]);

  async function pay(id: string) {
    setBusyId(id);
    try {
      const r = await api<{ url: string }>("/api/payments/checkout", { method: "POST", body: { appointmentId: id } });
      window.location.href = r.url; // Stripe's secure payment page
    } catch (e) {
      setFlash({ kind: "error", text: (e as Error).message });
      setBusyId(null);
    }
  }

  async function act(id: string, kind: "cancel" | "delete") {
    const q = kind === "cancel" ? "Cancel this appointment?" : "Remove this appointment from your history? This can't be undone.";
    if (!window.confirm(q)) return;
    setBusyId(id);
    try {
      if (kind === "cancel") await api(`/api/appointments/${id}`, { method: "PATCH", body: { action: "cancel" } });
      else await api(`/api/appointments/${id}`, { method: "DELETE" });
      setFlash({ kind: "ok", text: kind === "cancel" ? "Appointment cancelled." : "Appointment deleted." });
      await load();
    } catch (e) {
      setFlash({ kind: "error", text: (e as Error).message });
    } finally {
      setBusyId(null);
    }
  }

  const upcoming = (list ?? [])
    .filter((a) => a.isActive && !a.isPast)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  const past = (list ?? []).filter((a) => !(a.isActive && !a.isPast));
  const shown = tab === "upcoming" ? upcoming : past;

  return (
    <div className="container section">
      <div className="spread">
        <div>
          <h1>{user ? `Hi, ${user.name.split(" ")[0]}` : "My appointments"}</h1>
          <p className="muted">Manage your bookings and details.</p>
        </div>
        <Link href="/book" className="btn">New booking</Link>
      </div>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}

      <div className="tabs" role="tablist">
        <button className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>Upcoming ({upcoming.length})</button>
        <button className={tab === "past" ? "active" : ""} onClick={() => setTab("past")}>Past &amp; cancelled ({past.length})</button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Profile &amp; password</button>
      </div>

      {tab === "profile" ? (
        <SettingsView embedded />
      ) : list === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card center">
          <p className="muted">{tab === "upcoming" ? "No upcoming appointments." : "Nothing here yet."}</p>
          {tab === "upcoming" && <Link href="/book" className="btn">Book your next visit</Link>}
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {shown.map((a) => (
            <AppointmentCard key={a.id} a={a} busy={busyId === a.id} onCancel={() => act(a.id, "cancel")} onPay={payOnline && a.canPayOnline ? () => pay(a.id) : undefined} onDelete={() => act(a.id, "delete")} />
          ))}
        </div>
      )}
    </div>
  );
}
