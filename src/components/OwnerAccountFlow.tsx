"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api } from "@/lib/client";

interface Props {
  mode: "signup" | "recover";
  firstOwner?: boolean; // signup: no owner exists yet → also set the staff team code
  setupCodeRequired?: boolean;
}

/** New owner account (email code → password + owner code) and "forgot owner code" (email code → new code). */
export default function OwnerAccountFlow({ mode, firstOwner = false, setupCodeRequired = false }: Props) {
  const router = useRouter();
  const signup = mode === "signup";
  const [step, setStep] = useState<"email" | "details">("email");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string; devCode?: string }>("/api/auth/email-code", { method: "POST", body: { email, purpose: signup ? "OWNER_SIGNUP" : "OWNER_RESET" } });
      setInfo(r.devCode ? `Test mode (no email service yet): your code is ${r.devCode}` : r.message);
      setStep("details");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.ownerCode !== f.ownerCode2 || f.newOwnerCode !== f.newOwnerCode2) {
      setError("The two owner codes don't match.");
      setBusy(false);
      return;
    }
    delete f.ownerCode2;
    delete f.newOwnerCode2;
    try {
      const r = await api<{ home: string }>(signup ? "/api/auth/owner-setup" : "/api/auth/owner-reset", { method: "POST", body: { ...f, email } });
      router.push(r.home);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-side team">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow" style={{ color: "#f3d9a8" }}>Maple &amp; Mane · Owner</div>
          <h2>{signup ? "Create an owner account" : "Reset your owner code"}</h2>
          <p>
            {signup
              ? firstOwner
                ? "Set up the salon's first owner account. You'll verify your email, choose a password and your personal owner code."
                : "Your email must be invited by an existing owner (Owner → Team → Co-owners)."
              : "We'll email you a 6-digit code to prove it's you, then you choose a new owner code (and password if you like)."}
          </p>
        </div>
        <ul className="hide-sm">
          <li>📧 <span>Email verified with a 6-digit code (valid 10 minutes)</span></li>
          <li>🔑 <span>Owner login = email + password + owner code</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1 style={{ fontSize: "2rem" }}>{signup ? "New owner account" : "Forgot owner code"}</h1>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {info && <div className="alert alert-gold small">{info}</div>}

          {step === "email" ? (
            <form onSubmit={sendCode}>
              <div className="field">
                <label htmlFor="o-email">Your email</label>
                <input id="o-email" type="email" required maxLength={120} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
            </form>
          ) : (
            <form onSubmit={finish}>
              <div className="field">
                <label htmlFor="o-code">6-digit code sent to {email}</label>
                <input id="o-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="\d{6}" className="code-input" />
              </div>
              {signup ? (
                <>
                  <div className="field"><label htmlFor="o-name">Full name</label><input id="o-name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" /></div>
                  <div className="field"><label htmlFor="o-phone">Phone</label><input id="o-phone" name="phone" type="tel" required autoComplete="tel" /></div>
                  <div className="field">
                    <label htmlFor="o-pw">Password</label>
                    <input id="o-pw" name="password" type="password" required minLength={8} maxLength={100} autoComplete="new-password" />
                    <div className="hint">At least 8 characters, with a letter and a number.</div>
                  </div>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div className="field" style={{ flex: 1 }}><label htmlFor="o-oc">Set your owner code</label><input id="o-oc" name="ownerCode" type="password" inputMode="numeric" required pattern="\d{4,8}" maxLength={8} className="code-input" placeholder="4–8 digits" autoComplete="off" /></div>
                    <div className="field" style={{ flex: 1 }}><label htmlFor="o-oc2">Repeat owner code</label><input id="o-oc2" name="ownerCode2" type="password" inputMode="numeric" required pattern="\d{4,8}" maxLength={8} className="code-input" autoComplete="off" /></div>
                  </div>
                  {firstOwner && (
                    <div className="field">
                      <label htmlFor="o-team">Team secret code for your staff</label>
                      <input id="o-team" name="teamCode" type="text" className="code-input" required minLength={6} maxLength={32} pattern="[A-Za-z0-9\-]+" spellCheck={false} placeholder="e.g. MAPLE-TEAM-2026" autoComplete="off" />
                      <div className="hint">Staff need this to join and at every login. Change it any time on Owner → Team.</div>
                    </div>
                  )}
                  {firstOwner && setupCodeRequired && (
                    <div className="field"><label htmlFor="o-setup">Setup code</label><input id="o-setup" name="setupCode" type="password" required maxLength={64} autoComplete="off" /><div className="hint">The SETUP_CODE saved in the website settings.</div></div>
                  )}
                </>
              ) : (
                <>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <div className="field" style={{ flex: 1 }}><label htmlFor="r-oc">New owner code</label><input id="r-oc" name="newOwnerCode" type="password" inputMode="numeric" required pattern="\d{4,8}" maxLength={8} className="code-input" placeholder="4–8 digits" autoComplete="off" /></div>
                    <div className="field" style={{ flex: 1 }}><label htmlFor="r-oc2">Repeat new code</label><input id="r-oc2" name="newOwnerCode2" type="password" inputMode="numeric" required pattern="\d{4,8}" maxLength={8} className="code-input" autoComplete="off" /></div>
                  </div>
                  <div className="field">
                    <label htmlFor="r-pw">New password <span className="muted">(optional — leave empty to keep it)</span></label>
                    <input id="r-pw" name="newPassword" type="password" minLength={8} maxLength={100} autoComplete="new-password" />
                  </div>
                </>
              )}
              <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Please wait…" : signup ? "Create owner account" : "Save and log in"}</button>
              <button type="button" className="linklike small" style={{ marginTop: 10 }} onClick={() => { setStep("email"); setInfo(null); setError(null); }}>← Use a different email</button>
            </form>
          )}
          <p className="small muted center" style={{ marginTop: 22 }}><Link href="/team?as=owner">← Back to team login</Link></p>
        </div>
      </div>
    </div>
  );
}
