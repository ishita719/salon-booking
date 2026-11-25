"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";

/** What the salon QR code opens when you aren't signed in yet: name + phone, then straight to booking. */
export default function QuickJoin({ expired, next }: { expired?: boolean; next?: string }) {
  const router = useRouter();
  const booking = next === "/book" || next?.startsWith("/book?");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "That login QR has expired or was already used. Log in with your name and phone below, or ask the front desk for a new QR." : null,
  );

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home?: string }>("/api/auth/quick-join", { method: "POST", body: form });
      router.push(next ?? r.home ?? "/account");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 30 }}>
        <div className="eyebrow">Welcome to Maple &amp; Mane</div>
        <h1 style={{ fontSize: "2rem" }}>{booking ? "Book your visit ✦" : "Log in or join ✦"}</h1>
        <p className="muted">
          {booking
            ? "Just your name and phone, then pick your service and time. No password — you'll stay signed in on this phone."
            : "No passwords. Just your name and phone — new or returning. You'll stay signed in on this phone."}
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={join}>
          <div className="field">
            <label htmlFor="qj-name">Your name</label>
            <input id="qj-name" type="text" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="hint">Returning? Use the first name you signed up with.</div>
          </div>
          <div className="field">
            <label htmlFor="qj-phone">Mobile number</label>
            <input id="qj-phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="604-555-1234" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="qj-email">Email <span className="muted">(optional)</span></label>
            <input id="qj-email" type="email" autoComplete="email" maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="hint">New clients only — for booking confirmations.</div>
          </div>
          <button className="btn btn-lg btn-block" disabled={busy}>{busy ? "One moment…" : booking ? "Continue to booking →" : "Continue"}</button>
        </form>
        <p className="small muted center" style={{ marginTop: 18, marginBottom: 0 }}>
          Work at the salon? <Link href="/team">Team login</Link>
        </p>
      </div>
    </div>
  );
}
