"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client";

type LoginRole = "CUSTOMER" | "STAFF" | "OWNER";

const ROLE_TEXT: Record<LoginRole, { option: string; title: string; subtitle: string }> = {
  CUSTOMER: { option: "Client", title: "Client login", subtitle: "Log in to book and manage your appointments." },
  STAFF: { option: "Staff", title: "Staff login", subtitle: "See your schedule, update appointments and request time off." },
  OWNER: { option: "Owner", title: "Owner login", subtitle: "Manage the salon: bookings, team, clients, services and reports." },
};

/** Only allow redirecting to our own pages after login (prevents open-redirect attacks). */
function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : null;
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<LoginRole>("CUSTOMER");
  const isLogin = mode === "login";

  // Pre-select from the link (/login?as=staff) or the last choice on this device.
  useEffect(() => {
    if (!isLogin) return;
    const as = new URLSearchParams(window.location.search).get("as")?.toUpperCase();
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("loginRole");
    } catch {}
    const pick = as === "CLIENT" ? "CUSTOMER" : as || saved;
    if (pick === "CUSTOMER" || pick === "STAFF" || pick === "OWNER") setRole(pick);
  }, [isLogin]);

  function chooseRole(r: LoginRole) {
    setRole(r);
    setError(null);
    try {
      localStorage.setItem("loginRole", r);
    } catch {}
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const res = await api<{ home?: string }>(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: isLogin ? { ...f, role } : f,
      });
      // Each role lands on its own portal; a "next" link is honoured if it was saved before login.
      router.push(safeNext() ?? res.home ?? "/account");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const text = ROLE_TEXT[role];

  return (
    <div className="container section">
      <div className="card form-narrow">
        <h1 style={{ fontSize: "1.8rem" }}>{isLogin ? text.title : "Create your account"}</h1>
        <p className="muted">{isLogin ? text.subtitle : "It only takes a minute — then you can book right away."}</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={onSubmit} noValidate={false}>
          {isLogin && (
            <div className="field">
              <label htmlFor="role">I am a</label>
              <select id="role" value={role} onChange={(e) => chooseRole(e.target.value as LoginRole)}>
                {(Object.keys(ROLE_TEXT) as LoginRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_TEXT[r].option}</option>
                ))}
              </select>
            </div>
          )}
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
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Please wait…" : isLogin ? `Log in as ${text.option.toLowerCase()}` : "Create account"}
          </button>
        </form>
        <p className="small muted center" style={{ marginTop: 16, marginBottom: 0 }}>
          {!isLogin ? (
            <>Already have an account? <Link href="/login">Log in</Link></>
          ) : role === "CUSTOMER" ? (
            <>New here? <Link href="/register">Create an account</Link></>
          ) : role === "STAFF" ? (
            <>Staff logins are created by the salon owner. Forgot your password? Ask the owner to reset it.</>
          ) : (
            <>The owner account is set up when the website is installed.</>
          )}
        </p>
      </div>
    </div>
  );
}
