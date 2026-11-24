"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import LoginQrButton from "@/components/LoginQrButton";
import { api } from "@/lib/client";

type User = { name: string; email: string | null; phone: string; role: string; hasPassword: boolean };

/** Profile, password, owner code and "log in on another device". Used by every role. */
export default function SettingsView({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tempCode, setTempCode] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ user: User }>("/api/me")
      .then((r) => {
        setUser(r.user);
        if (r.user.role === "OWNER") api<{ usingTemporary: boolean }>("/api/me/owner-code").then((x) => setTempCode(x.usingTemporary)).catch(() => {});
      })
      .catch((e) => setFlash({ kind: "error", text: e.message }));
  }, []);

  const ok = (text: string) => setFlash({ kind: "ok", text });
  const fail = (err: unknown) => setFlash({ kind: "error", text: (err as Error).message });

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const r = await api<{ user: User }>("/api/me", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) });
      setUser(r.user);
      ok("Profile saved.");
      router.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.newPassword !== f.confirm) return setFlash({ kind: "error", text: "The new passwords don't match." });
    try {
      await api("/api/me/password", { method: "PATCH", body: { currentPassword: f.currentPassword ?? "", newPassword: f.newPassword } });
      form.reset();
      setUser((u) => (u ? { ...u, hasPassword: true } : u));
      ok(user?.hasPassword ? "Password changed." : "Password set — you can now also log in with email + password.");
    } catch (err) {
      fail(err);
    }
  }

  async function changeOwnerCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.newCode !== f.newCode2) return setFlash({ kind: "error", text: "The two secret codes don't match." });
    try {
      await api("/api/me/owner-code", { method: "PATCH", body: { currentCode: f.currentCode, newCode: f.newCode } });
      form.reset();
      setTempCode(false);
      ok("Secret code changed. Use it next time you log in.");
    } catch (err) {
      fail(err);
    }
  }

  const client = user?.role === "CUSTOMER";
  const body = (
    <>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}
      {user && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
          <form className="card" onSubmit={saveProfile}>
            <h3>Profile</h3>
            {client ? (
              <div className="field">
                <label htmlFor="p-email">Email</label>
                <input id="p-email" name="email" type="email" maxLength={120} defaultValue={user.email ?? ""} placeholder="Add your email" />
                <div className="hint">Only used for booking confirmations (optional).</div>
              </div>
            ) : (
              <div className="field"><label htmlFor="p-email">Email (login)</label><input id="p-email" type="email" value={user.email ?? ""} disabled /></div>
            )}
            <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" name="name" type="text" defaultValue={user.name} required /></div>
            <div className="field"><label htmlFor="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" defaultValue={user.phone} required /></div>
            <button className="btn">Save profile</button>
          </form>

          {user.role === "STAFF" && (
          <form className="card" onSubmit={changePassword}>
            <h3>{user.hasPassword ? "Change password" : "Set a password (optional)"}</h3>
            {!user.hasPassword && <p className="small muted">You signed up with the salon QR — no password needed. Add one only if you&apos;d like to log in with email + password.</p>}
            {user.hasPassword && <div className="field"><label htmlFor="pw-cur">Current password</label><input id="pw-cur" name="currentPassword" type="password" required autoComplete="current-password" /></div>}
            <div className="field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
              <div className="hint">At least 8 characters, with a letter and a number.</div>
            </div>
            <div className="field"><label htmlFor="pw-conf">Repeat new password</label><input id="pw-conf" name="confirm" type="password" required autoComplete="new-password" /></div>
            <button className="btn">{user.hasPassword ? "Change password" : "Set password"}</button>
          </form>
          )}

          {user.role === "OWNER" && (
            <form className="card" onSubmit={changeOwnerCode}>
              <h3>Secret code</h3>
              {tempCode && <div className="alert alert-gold small">You&apos;re still using the temporary code — it&apos;s short and easy to guess. Please set your own now.</div>}
              <p className="small muted">Your secret code is your owner login. Forgot it? Use “Forgot secret code” on the owner login page.</p>
              <div className="field"><label htmlFor="oc-cur">Current secret code</label><input id="oc-cur" name="currentCode" type="password" required className="code-input" autoComplete="current-password" /></div>
              <div className="field">
                <label htmlFor="oc-new">New secret code</label>
                <input id="oc-new" name="newCode" type="password" required minLength={6} maxLength={32} pattern="[A-Za-z0-9\-]+" className="code-input" autoComplete="new-password" spellCheck={false} />
                <div className="hint">6–32 letters, numbers or dashes — e.g. Maple-Owner-26.</div>
              </div>
              <div className="field"><label htmlFor="oc-new2">Repeat new secret code</label><input id="oc-new2" name="newCode2" type="password" required minLength={6} maxLength={32} className="code-input" autoComplete="new-password" /></div>
              <button className="btn">Change secret code</button>
            </form>
          )}

          {client && (
            <section className="card">
              <h3>Log in on another device</h3>
              <p className="small muted">Clients sign in with QR codes only. To use a new phone or tablet, show your one-time login QR here and scan it with the new device — it works once, for 10 minutes.</p>
              <LoginQrButton label="Show my login QR" className="btn" />
            </section>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return body;
  return (
    <div className="container section">
      <h1>Settings</h1>
      {body}
    </div>
  );
}
