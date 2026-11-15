"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client";

type User = { name: string; email: string; phone: string };

/** Profile details + password change. Used by every role. */
export default function SettingsView({ embedded }: { embedded?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api<{ user: User }>("/api/me").then((r) => setUser(r.user)).catch((e) => setFlash({ kind: "error", text: e.message }));
  }, []);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const r = await api<{ user: User }>("/api/me", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) });
      setUser(r.user);
      setFlash({ kind: "ok", text: "Profile saved." });
      router.refresh();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (f.newPassword !== f.confirm) return setFlash({ kind: "error", text: "The new passwords don't match." });
    try {
      await api("/api/me/password", { method: "PATCH", body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      form.reset();
      setFlash({ kind: "ok", text: "Password changed." });
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    }
  }

  const body = (
    <>
      {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}
      {user && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
          <form className="card" onSubmit={saveProfile}>
            <h3>Profile</h3>
            <div className="field"><label htmlFor="p-email">Email (login)</label><input id="p-email" type="email" value={user.email} disabled /></div>
            <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" name="name" type="text" defaultValue={user.name} required /></div>
            <div className="field"><label htmlFor="p-phone">Phone</label><input id="p-phone" name="phone" type="tel" defaultValue={user.phone} required /></div>
            <button className="btn">Save profile</button>
          </form>
          <form className="card" onSubmit={changePassword}>
            <h3>Change password</h3>
            <div className="field"><label htmlFor="pw-cur">Current password</label><input id="pw-cur" name="currentPassword" type="password" required autoComplete="current-password" /></div>
            <div className="field">
              <label htmlFor="pw-new">New password</label>
              <input id="pw-new" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
              <div className="hint">At least 8 characters, with a letter and a number.</div>
            </div>
            <div className="field"><label htmlFor="pw-conf">Repeat new password</label><input id="pw-conf" name="confirm" type="password" required autoComplete="new-password" /></div>
            <button className="btn">Change password</button>
          </form>
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
