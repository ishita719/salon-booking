"use client";

import QrCode from "@/components/QrCode";

/** Printable poster with the salon's sign-in QR (for reception, mirrors, flyers). */
export default function QrPoster({ url }: { url: string }) {
  return (
    <div className="stack">
      <div className="row no-print">
        <button className="btn" onClick={() => window.print()}>🖨 Print poster</button>
        <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(url)}>Copy link</button>
        <span className="small muted">Link: <code>{url}</code></span>
      </div>
      <div className="qr-poster card center">
        <div className="logo" style={{ justifyContent: "center", fontSize: "1.8rem" }}><span className="logo-mark" aria-hidden>✦</span>Maple <em>&amp;</em> Mane</div>
        <h2 style={{ margin: "18px 0 6px" }}>Scan to book in 30 seconds</h2>
        <p className="muted" style={{ marginBottom: 18 }}>No app. No password. Just your name and phone.</p>
        <div style={{ display: "grid", placeItems: "center" }}>
          <QrCode value={url} size={280} label="Scan to sign in and book" />
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: 18, gap: 8 }}>
          <span className="tag">✦ Free skin check</span>
          <span className="tag tag-gold">Member offers</span>
          <span className="tag">Book &amp; pay online</span>
        </div>
        <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>Point your phone camera at the code</p>
      </div>
    </div>
  );
}
