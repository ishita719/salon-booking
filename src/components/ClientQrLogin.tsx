"use client";

import Link from "next/link";
import QrCode from "@/components/QrCode";

/** Client login = QR only. On a computer: scan this QR with your phone. Already on your phone: continue here. */
export default function ClientQrLogin({ welcomeUrl }: { welcomeUrl: string }) {
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="eyebrow" style={{ color: "#f3d9a8" }}>Client area</div>
          <h2>Sign in with a quick scan</h2>
          <p>No passwords, no sign-up forms. Scan the QR code — or just type your name and phone. Your phone stays signed in.</p>
        </div>
        <ul className="hide-sm">
          <li>📱 <span>New here? Scan → name + phone → done</span></li>
          <li>🔁 <span>Been here before? Same name + phone and you&apos;re back in</span></li>
          <li>✦ <span>Free skin check, member offers, online booking &amp; payment</span></li>
        </ul>
      </aside>
      <div className="auth-main">
        <div className="auth-card center">
          <h1 style={{ fontSize: "2rem" }}>Client login</h1>
          <p className="muted">Point your phone&apos;s camera at this code</p>
          <div style={{ display: "grid", placeItems: "center", margin: "18px 0" }}>
            <QrCode value={welcomeUrl} size={240} label="Scan to sign in with your phone" />
          </div>
          <div className="or-divider"><span>QR not working, or already on your phone?</span></div>
          <Link href="/welcome" className="btn btn-lg btn-block">Log in with name &amp; phone</Link>
          <p className="small muted" style={{ marginTop: 10 }}>New here? The same page creates your account — no password needed.</p>
          <p className="small muted" style={{ marginTop: 22 }}>Work at the salon? <Link href="/team">Salon team login →</Link></p>
        </div>
      </div>
    </div>
  );
}
