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

/** CLIENT login and sign-up. The salon team uses /team instead. */
export default function ClientAuth({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await api<{ home: string }>(isLogin ? "/api/auth/login" : "/api/auth/register", { method: "POST", body });
      router.push(safeNext() ?? res.home);
      router.refresh();
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
          <li>✦ <span>Live availability for every stylist</span></li>
          <li>✦ <span>Reschedule or cancel online</span></li>
          <li>✦ <span>Studio or at-home visits</span></li>
          <li>✦ <span>Rate your visit and send feedback</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1 style={{ fontSize: "2rem" }}>{isLogin ? "Client login" : "Create your account"}</h1>
          <p className="muted">{isLogin ? "Log in to book and manage your appointments." : "It only takes a minute — then you can book right away."}</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
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
                <div className="hint">So your stylist can reach you about your visit.</div>
              </div>
            )}
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" required minLength={isLogin ? 1 : 8} maxLength={100} autoComplete={isLogin ? "current-password" : "new-password"} />
              {!isLogin && <div className="hint">At least 8 characters, with a letter and a number.</div>}
            </div>
            <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
          </form>
          {isLogin ? (
            <>
              <div className="or-divider"><span>New to Maple &amp; Mane?</span></div>
              <Link href="/register" className="btn btn-outline btn-block">Create your account</Link>
            </>
          ) : (
            <p className="small muted center" style={{ marginTop: 16 }}>Already have an account? <Link href="/login">Log in</Link></p>
          )}
          <p className="small muted center" style={{ marginTop: 26 }}>
            Work at the salon? <Link href="/team">Salon team login →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
