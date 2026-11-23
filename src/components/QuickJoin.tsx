"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";

/** What the salon QR code opens: name + phone and you're in. No password. */
export default function QuickJoin({ expired }: { expired?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "code">("details");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [codeFor, setCodeFor] = useState<{ email: string; masked: string; devCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "That login QR has expired or was already used. Enter your details below, or ask the front desk for a new one." : null);

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home?: string; needsCode?: boolean; email?: string; maskedEmail?: string; devCode?: string }>("/api/auth/quick-join", { method: "POST", body: form });
      if (r.needsCode) {
        setCodeFor({ email: r.email!, masked: r.maskedEmail!, devCode: r.devCode });
        setStep("code");
        setBusy(false);
        return;
      }
      router.push(r.home ?? "/account");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!codeFor) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home: string }>("/api/auth/email-login", { method: "POST", body: { email: codeFor.email, code } });
      router.push(r.home);
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
        {step === "details" ? (
          <>
            <h1 style={{ fontSize: "2rem" }}>You&apos;re one step away ✦</h1>
            <p className="muted">No passwords. Just your name and phone — you&apos;ll stay signed in on this phone.</p>
            {error && <div className="alert alert-error" role="alert">{error}</div>}
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
                <div className="hint">For booking confirmations, and to log in on another phone later.</div>
              </div>
              <button className="btn btn-lg btn-block" disabled={busy}>{busy ? "One moment…" : "Continue"}</button>
            </form>
            <p className="small muted center" style={{ marginTop: 18, marginBottom: 0 }}>
              Prefer a password? <Link href="/login">Client login</Link>
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "2rem" }}>Welcome back!</h1>
            <p className="muted">This number already has an account. For your security we emailed a 6-digit code to <strong>{codeFor?.masked}</strong>.</p>
            {codeFor?.devCode && <div className="alert alert-gold small">Test mode (no email service yet): your code is <strong>{codeFor.devCode}</strong></div>}
            {error && <div className="alert alert-error" role="alert">{error}</div>}
            <form onSubmit={verify}>
              <div className="field">
                <label htmlFor="qj-code">6-digit code</label>
                <input id="qj-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              </div>
              <button className="btn btn-lg btn-block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Log in"}</button>
            </form>
            <p className="small muted" style={{ marginTop: 14 }}>No access to that email? Ask at the front desk — they can show you a one-time login QR.</p>
            <button className="linklike small" onClick={() => { setStep("details"); setCode(""); setError(null); }}>← Use a different number</button>
          </>
        )}
      </div>
    </div>
  );
}
