"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";

/** What the salon QR code opens: name + phone and you're in. No password, no email code. */
export default function QuickJoin({ expired }: { expired?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    expired ? "That login QR has expired or was already used. Ask the front desk for a new one, or show a new one from your other phone." : null,
  );

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setReturning(null);
    try {
      const r = await api<{ home?: string }>("/api/auth/quick-join", { method: "POST", body: form });
      router.push(r.home ?? "/account");
      router.refresh();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.startsWith("Welcome back")) setReturning(msg);
      else setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 30 }}>
        <div className="eyebrow">Welcome to Maple &amp; Mane</div>
        <h1 style={{ fontSize: "2rem" }}>Log in or join ✦</h1>
        <p className="muted">No passwords. Just your name and phone — new or returning. You&apos;ll stay signed in on this phone.</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {returning ? (
          <div className="stack">
            <div className="alert alert-info" role="status">
              <strong>Welcome back!</strong> This number already has an account. To sign in on this phone, scan your personal login QR:
            </div>
            <div className="card-flat">
              <strong>📍 At the salon</strong>
              <p className="small muted" style={{ margin: "4px 0 0" }}>Ask the front desk — they&apos;ll show your one-time login QR. Scan it with this phone&apos;s camera.</p>
            </div>
            <div className="card-flat">
              <strong>📱 Have your other phone?</strong>
              <p className="small muted" style={{ margin: "4px 0 0" }}>On it, open <strong>Settings → Show my login QR</strong>, then scan that QR with this phone.</p>
            </div>
            <button className="btn btn-ghost" onClick={() => setReturning(null)}>← Use a different number</button>
          </div>
        ) : (
          <form onSubmit={join}>
            <div className="field">
              <label htmlFor="qj-name">Your name</label>
              <input id="qj-name" type="text" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <button className="btn btn-lg btn-block" disabled={busy}>{busy ? "One moment…" : "Continue"}</button>
          </form>
        )}
        <p className="small muted center" style={{ marginTop: 18, marginBottom: 0 }}>
          Work at the salon? <Link href="/team">Team login</Link>
        </p>
      </div>
    </div>
  );
}
