"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client";

type Mode = "login" | "join";

function safeNext(): string | null {
  if (typeof window === "undefined") return null;
  const n = new URLSearchParams(window.location.search).get("next");
  return n && (n.startsWith("/owner") || n.startsWith("/staff") || n.startsWith("/book") || n.startsWith("/settings")) ? n : null;
}

const SIDE: Record<Mode, { title: string; text: string }> = {
  login: { title: "Salon team", text: "Owners: just your secret code. Staff: email, password and the team code from the owner — every time you sign in." },
  join: { title: "Join the team", text: "Create your staff account with the staff code the owner gave you. You'll land straight on your schedule." },
};

/** TEAM login (owner: secret code only; staff: email + password + team code) and staff sign-up (needs the team code). */
export default function TeamAuth({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [as, setAs] = useState<"OWNER" | "STAFF">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("as");
    if (q === "owner") setAs("OWNER");
    else if (mode === "login") {
      try {
        const saved = localStorage.getItem("teamLoginAs");
        if (saved === "OWNER" || saved === "STAFF") setAs(saved);
      } catch {}
    }
    if (mode === "login") api<{ needed: boolean }>("/api/auth/owner-setup").then((r) => setSetupNeeded(r.needed)).catch(() => {});
  }, [mode]);

  function choose(r: "OWNER" | "STAFF") {
    setAs(r);
    setError(null);
    try {
      localStorage.setItem("teamLoginAs", r);
    } catch {}
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const ownerLogin = mode === "login" && as === "OWNER";
    const url = ownerLogin ? "/api/auth/owner-login" : mode === "login" ? "/api/auth/team-login" : "/api/auth/staff-join";
    try {
      const res = await api<{ home: string }>(url, { method: "POST", body: f });
      router.push(safeNext() ?? res.home);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const staffLogin = mode === "login" && as === "STAFF";
  const title = mode === "join" ? "Create staff account" : as === "OWNER" ? "Owner login" : "Staff login";

  return (
    <div className="auth-wrap">
      <aside className="auth-side team">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow" style={{ color: "#f3d9a8" }}>Maple &amp; Mane · Team</div>
          <h2>{SIDE[mode].title}</h2>
          <p>{SIDE[mode].text}</p>
        </div>
        <ul className="hide-sm">
          <li>🔒 <span>Separate from the client area</span></li>
          <li>🔑 <span>Staff code required at every staff login</span></li>
          <li>🔁 <span>When the owner changes the code, all staff are signed out</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1 style={{ fontSize: "2rem" }}>{title}</h1>
          {mode === "login" && (
            <div className="segmented" role="tablist" aria-label="I am">
              <button type="button" role="tab" aria-selected={as === "OWNER"} className={as === "OWNER" ? "active" : ""} onClick={() => choose("OWNER")}>Owner</button>
              <button type="button" role="tab" aria-selected={as === "STAFF"} className={as === "STAFF" ? "active" : ""} onClick={() => choose("STAFF")}>Staff</button>
            </div>
          )}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={onSubmit}>
            {mode !== "login" && (
              <>
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" type="tel" required autoComplete="tel" />
                </div>
              </>
            )}
            {!(mode === "login" && as === "OWNER") && (
              <>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required maxLength={120} autoComplete="email" />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" required minLength={mode === "login" ? 1 : 8} maxLength={100} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                  {mode !== "login" && <div className="hint">At least 8 characters, with a letter and a number.</div>}
                </div>
              </>
            )}
            {(staffLogin || mode === "join") && (
              <div className="field">
                <label htmlFor="staffCode">Staff code</label>
                <input id="staffCode" name="staffCode" type="text" className="code-input" required minLength={4} maxLength={64} autoComplete="off" spellCheck={false} placeholder="MM-XXXX-XXXX" />
                <div className="hint">The code the owner shares with the team. Needed every time you log in.</div>
              </div>
            )}
            {mode === "login" && as === "OWNER" && (
              <div className="field">
                <label htmlFor="ownerCode">Secret code</label>
                <input id="ownerCode" name="code" type="password" className="code-input" required minLength={4} maxLength={64} autoComplete="current-password" autoFocus spellCheck={false} placeholder="Your owner secret code" />
                <div className="hint">Owners log in with their secret code only.</div>
              </div>
            )}
            <button className="btn btn-block btn-lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "join" ? "Create staff account" : `Log in as ${as === "OWNER" ? "owner" : "staff"}`}
            </button>
          </form>

          {mode === "login" && as === "STAFF" && (
            <>
              <div className="or-divider"><span>New to the team?</span></div>
              <Link href="/team/join" className="btn btn-outline btn-block">Create your staff account</Link>
              <p className="small muted center" style={{ marginTop: 10 }}>You&apos;ll need the staff code from the owner. Forgot your password? Ask the owner to reset it.</p>
            </>
          )}
          {mode === "login" && as === "OWNER" && (
            <>
              <p className="small center" style={{ marginTop: 12 }}><Link href="/team/recover">Forgot secret code?</Link></p>
              <div className="or-divider"><span>New owner?</span></div>
              <Link href="/team/setup" className="btn btn-outline btn-block">Create an owner account</Link>
              {setupNeeded && <div className="alert alert-gold small" style={{ marginTop: 12 }}>No owner account exists yet — create the first one.</div>}
            </>
          )}
          {mode !== "login" && <p className="small muted center" style={{ marginTop: 16 }}>Already have an account? <Link href="/team">Team login</Link></p>}
          <p className="small muted center" style={{ marginTop: 26 }}>Are you a client? <Link href="/login">Client login →</Link></p>
        </div>
      </div>
    </div>
  );
}
