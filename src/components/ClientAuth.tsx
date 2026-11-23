"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";

/** Only allow redirecting to our own pages after login (prevents open-redirect attacks). */
function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

/** CLIENT login (password or emailed code) and sign-up. The salon team uses /team instead. */
export default function ClientAuth({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"code" | "password">("code");
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const isLogin = mode === "login";

  const done = (home: string) => {
    router.push(safeNext() ?? home);
    router.refresh();
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await api<{ home: string }>(isLogin ? "/api/auth/login" : "/api/auth/register", { method: "POST", body });
      done(res.home);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ message: string; devCode?: string }>("/api/auth/email-code", { method: "POST", body: { email, purpose: "CLIENT_LOGIN" } });
      setCodeSent(true);
      setInfo(r.devCode ? `Test mode (no email service yet): your code is ${r.devCode}` : r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ home: string }>("/api/auth/email-login", { method: "POST", body: { email, code } });
      done(r.home);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow" style={{ color: "#f3d9a8" }}>Client area</div>
          <h2>{isLogin ? "Welcome back" : "Your salon, in your pocket"}</h2>
          <p>Book in seconds, manage your visits and tell us how we did.</p>
        </div>
        <ul className="hide-sm">
          <li>📱 <span>At the salon? Just scan our QR code — no password needed</span></li>
          <li>✦ <span>Free online skin check and member offers</span></li>
          <li>✦ <span>Reschedule, cancel or pay online</span></li>
          <li>✦ <span>Studio or at-home visits</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1 style={{ fontSize: "2rem" }}>{isLogin ? "Client login" : "Create your account"}</h1>
          <p className="muted">{isLogin ? "Log in to book and manage your appointments." : "It only takes a minute — then you can book right away."}</p>

          {!isLogin && (
            <div className="alert alert-gold small">
              ⚡ Quicker: <Link href="/welcome">sign up with just your name &amp; phone</Link> — no password needed.
            </div>
          )}

          {isLogin && (
            <div className="segmented" role="tablist" aria-label="Login method">
              <button type="button" role="tab" aria-selected={method === "code"} className={method === "code" ? "active" : ""} onClick={() => { setMethod("code"); setError(null); }}>Email me a code</button>
              <button type="button" role="tab" aria-selected={method === "password"} className={method === "password" ? "active" : ""} onClick={() => { setMethod("password"); setError(null); }}>Password</button>
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {info && isLogin && method === "code" && <div className="alert alert-gold small">{info}</div>}

          {isLogin && method === "code" ? (
            !codeSent ? (
              <form onSubmit={sendCode}>
                <div className="field">
                  <label htmlFor="c-email">Email</label>
                  <input id="c-email" type="email" required maxLength={120} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <div className="hint">We&apos;ll email you a 6-digit code — no password to remember.</div>
                </div>
                <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Sending…" : "Send my code"}</button>
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <div className="field">
                  <label htmlFor="c-code">6-digit code sent to {email}</label>
                  <input id="c-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                </div>
                <button className="btn btn-block btn-lg" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Log in"}</button>
                <button type="button" className="linklike small" style={{ marginTop: 10 }} onClick={() => { setCodeSent(false); setCode(""); setInfo(null); }}>← Use a different email</button>
              </form>
            )
          ) : (
            <form onSubmit={onSubmit}>
              {!isLogin && (
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" />
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required maxLength={120} autoComplete="email" />
              </div>
              {!isLogin && (
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" type="tel" required placeholder="604-555-1234" autoComplete="tel" />
                </div>
              )}
              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" required minLength={isLogin ? 1 : 8} maxLength={100} autoComplete={isLogin ? "current-password" : "new-password"} />
                {!isLogin && <div className="hint">At least 8 characters, with a letter and a number.</div>}
              </div>
              <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
            </form>
          )}

          {isLogin ? (
            <>
              <div className="or-divider"><span>New to Maple &amp; Mane?</span></div>
              <Link href="/welcome" className="btn btn-outline btn-block">Start with just name &amp; phone</Link>
              <p className="small muted center" style={{ marginTop: 10 }}>Or <Link href="/register">create an account with a password</Link></p>
            </>
          ) : (
            <p className="small muted center" style={{ marginTop: 16 }}>Already have an account? <Link href="/login">Log in</Link></p>
          )}
          <p className="small muted center" style={{ marginTop: 22 }}>
            Work at the salon? <Link href="/team">Salon team login →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
