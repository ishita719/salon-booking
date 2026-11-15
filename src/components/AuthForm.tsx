"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client";

type LoginRole = "CUSTOMER" | "STAFF" | "OWNER";

const ROLE_TEXT: Record<LoginRole, { option: string; title: string; subtitle: string; signupTitle: string; signupNote: string }> = {
  CUSTOMER: {
    option: "Client",
    title: "Client login",
    subtitle: "Log in to book and manage your appointments.",
    signupTitle: "Create your client account",
    signupNote: "It only takes a minute — then you can book right away.",
  },
  STAFF: {
    option: "Staff",
    title: "Staff login",
    subtitle: "See your schedule, update appointments and request time off.",
    signupTitle: "Create your staff account",
    signupNote: "The salon owner will review your request. You can log in once it's approved.",
  },
  OWNER: {
    option: "Owner",
    title: "Owner login",
    subtitle: "Manage the salon: bookings, team, clients, services and reports.",
    signupTitle: "Create an owner account",
    signupNote: "Requires the owner access code set by the business. Without it, owner sign-up is refused.",
  },
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
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const isLogin = mode === "login";

  // Pre-select from the link (/login?as=staff) or the last choice on this device.
  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get("as")?.toUpperCase();
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("loginRole");
    } catch {}
    const pick = as === "CLIENT" ? "CUSTOMER" : as || saved;
    if (pick === "CUSTOMER" || pick === "STAFF" || pick === "OWNER") setRole(pick);
  }, []);

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
      const res = await api<{ home?: string; pending?: boolean; message?: string }>(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        body: { ...f, role },
      });
      if (res.pending) {
        // Staff sign-up: not logged in yet — waits for the owner's approval.
        setPendingMsg(res.message ?? "Your request was sent to the salon owner.");
        setBusy(false);
        return;
      }
      // Each role lands on its own portal; a "next" link is honoured if it was saved before login.
      router.push(safeNext() ?? res.home ?? "/account");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const text = ROLE_TEXT[role];

  if (pendingMsg) {
    return (
      <div className="container section">
        <div className="card form-narrow center">
          <h1 style={{ fontSize: "1.8rem" }}>Request sent ✓</h1>
          <div className="alert alert-ok" role="status">{pendingMsg}</div>
          <Link href="/login?as=staff" className="btn btn-outline">Go to staff login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="card form-narrow">
        <h1 style={{ fontSize: "1.8rem" }}>{isLogin ? text.title : text.signupTitle}</h1>
        <p className="muted">{isLogin ? text.subtitle : text.signupNote}</p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form onSubmit={onSubmit} noValidate={false}>
          <div className="field">
            <label htmlFor="role">I am a</label>
            <select id="role" value={role} onChange={(e) => chooseRole(e.target.value as LoginRole)}>
              {(Object.keys(ROLE_TEXT) as LoginRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_TEXT[r].option}</option>
              ))}
            </select>
          </div>
          {!isLogin && role === "OWNER" && (
            <div className="field">
              <label htmlFor="ownerCode">Owner access code</label>
              <input id="ownerCode" name="ownerCode" type="password" required autoComplete="off" maxLength={200} />
              <div className="hint">The private code given to you by the business.</div>
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
              <div className="hint">{role === "CUSTOMER" ? "So your stylist can reach you about your visit." : "So the salon can reach you."}</div>
            </div>
          )}
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required minLength={isLogin ? 1 : 8} maxLength={100} autoComplete={isLogin ? "current-password" : "new-password"} />
            {!isLogin && <div className="hint">At least 8 characters, with a letter and a number.</div>}
          </div>
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Please wait…" : isLogin ? `Log in as ${text.option.toLowerCase()}` : role === "STAFF" ? "Request staff account" : `Create ${text.option.toLowerCase()} account`}
          </button>
        </form>
        {isLogin ? (
          <>
            <div className="or-divider"><span>New to {"Maple & Mane"}?</span></div>
            <Link href={`/register?as=${role === "CUSTOMER" ? "client" : role.toLowerCase()}`} className="btn btn-outline" style={{ width: "100%" }}>
              Create your account
            </Link>
            {role === "STAFF" && (
              <p className="small muted center" style={{ marginTop: 10, marginBottom: 0 }}>Forgot your password? Ask the salon owner to reset it.</p>
            )}
          </>
        ) : (
          <p className="small muted center" style={{ marginTop: 16, marginBottom: 0 }}>
            Already have an account? <Link href={`/login?as=${role === "CUSTOMER" ? "client" : role.toLowerCase()}`}>Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
