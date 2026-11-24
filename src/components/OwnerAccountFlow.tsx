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

const CODE_HINT = "6–32 letters, numbers or dashes — e.g. Maple-Owner-26. This is your only login key, so keep it private.";

/** New owner account (name + email + secret code) and "forgot secret code" (email code → new secret code). */
export default function OwnerAccountFlow({ mode, firstOwner = false, setupCodeRequired = false }: Props) {
  const router = useRouter();
  const signup = mode === "signup";
  const [step, setStep] = useState<"email" | "details">(signup ? "details" : "email");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null); // owner request sent, waiting for approval

  const go = (home: string) => {
    router.push(home);
    router.refresh();
  };

  async function sendResetCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string; devCode?: string }>("/api/auth/email-code", { method: "POST", body: { email, purpose: "OWNER_RESET" } });
      setInfo(r.devCode ? `Test mode (no email service yet): your code is ${r.devCode}` : r.message);
      setStep("details");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const a = signup ? f.ownerCode : f.newOwnerCode;
    if (a !== f.repeat) {
      setError("The two secret codes don't match.");
      setBusy(false);
      return;
    }
    delete f.repeat;
    try {
      const r = await api<{ home?: string; pending?: boolean }>(signup ? "/api/auth/owner-setup" : "/api/auth/owner-reset", { method: "POST", body: signup ? f : { ...f, email } });
      if (r.pending) {
        setSubmitted(f.name?.split(" ")[0] ?? "");
        setBusy(false);
        return;
      }
      go(r.home ?? "/owner");
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
          <h2>{signup ? "Create an owner account" : "Forgot your secret code?"}</h2>
          <p>
            {signup
              ? firstOwner
                ? "Set up the salon's first owner: your name, email and a secret code. You'll log in with the secret code only."
                : "Enter your name, email and a secret code. An existing owner approves new owner accounts, then you log in with your secret code."
              : "We'll email you a 6-digit code to prove it's you, then you choose a new secret code."}
          </p>
        </div>
        <ul className="hide-sm">
          <li>🔑 <span>Owners log in with their secret code only</span></li>
          <li>🔒 <span>10 wrong codes → owner login locks for 15 minutes</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card">
          <h1 style={{ fontSize: "2rem" }}>{signup ? "New owner account" : "Reset secret code"}</h1>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {info && <div className="alert alert-gold small">{info}</div>}

          {submitted !== null ? (
            <div className="alert alert-ok" role="status">
              <strong>Thanks{submitted ? `, ${submitted}` : ""}! Your owner account is created.</strong>
              <p className="small" style={{ margin: "8px 0 0" }}>An existing owner just needs to approve it (Owner → Team). After that, log in with your secret code on the owner login page.</p>
            </div>
          ) : !signup && step === "email" ? (
            <form onSubmit={sendResetCode}>
              <div className="field">
                <label htmlFor="o-email">Your owner email</label>
                <input id="o-email" type="email" required maxLength={120} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Sending…" : "Email me a code"}</button>
            </form>
          ) : (
            <form onSubmit={submit}>
              {signup ? (
                <>
                  <div className="field"><label htmlFor="o-name">Full name</label><input id="o-name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="name" /></div>
                  <div className="field">
                    <label htmlFor="o-email2">Email</label>
                    <input id="o-email2" name="email" type="email" required maxLength={120} autoComplete="email" />
                    <div className="hint">Used if you ever forget your secret code.</div>
                  </div>
                  <div className="field">
                    <label htmlFor="o-code">Set your secret code</label>
                    <input id="o-code" name="ownerCode" type="password" required minLength={6} maxLength={32} pattern="[A-Za-z0-9\-]+" className="code-input" autoComplete="new-password" spellCheck={false} />
                    <div className="hint">{CODE_HINT}</div>
                  </div>
                  <div className="field"><label htmlFor="o-code2">Repeat secret code</label><input id="o-code2" name="repeat" type="password" required minLength={6} maxLength={32} className="code-input" autoComplete="new-password" /></div>
                  {firstOwner && (
                    <div className="field">
                      <label htmlFor="o-team">Team secret code for your staff</label>
                      <input id="o-team" name="teamCode" type="text" className="code-input" required minLength={6} maxLength={32} pattern="[A-Za-z0-9\-]+" spellCheck={false} placeholder="e.g. MAPLE-TEAM-2026" autoComplete="off" />
                      <div className="hint">Different from your owner code. Staff need it to join and at every login.</div>
                    </div>
                  )}
                  {firstOwner && setupCodeRequired && (
                    <div className="field"><label htmlFor="o-setup">Setup code</label><input id="o-setup" name="setupCode" type="password" required maxLength={64} autoComplete="off" /><div className="hint">The SETUP_CODE saved in the website settings.</div></div>
                  )}
                </>
              ) : (
                <>
                  <div className="field">
                    <label htmlFor="r-code">6-digit code sent to {email}</label>
                    <input id="r-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="\d{6}" className="code-input" />
                  </div>
                  <div className="field">
                    <label htmlFor="r-new">New secret code</label>
                    <input id="r-new" name="newOwnerCode" type="password" required minLength={6} maxLength={32} pattern="[A-Za-z0-9\-]+" className="code-input" autoComplete="new-password" spellCheck={false} />
                    <div className="hint">{CODE_HINT}</div>
                  </div>
                  <div className="field"><label htmlFor="r-new2">Repeat new secret code</label><input id="r-new2" name="repeat" type="password" required minLength={6} maxLength={32} className="code-input" autoComplete="new-password" /></div>
                </>
              )}
              <button className="btn btn-block btn-lg" disabled={busy}>{busy ? "Please wait…" : signup ? "Create owner account" : "Save and log in"}</button>
              {!signup && <button type="button" className="linklike small" style={{ marginTop: 10 }} onClick={() => { setStep("email"); setInfo(null); setError(null); }}>← Use a different email</button>}
            </form>
          )}
          <p className="small muted center" style={{ marginTop: 22 }}><Link href="/team?as=owner">← Back to owner login</Link></p>
        </div>
      </div>
    </div>
  );
}
