"use client";

import { useState } from "react";
import QrCode from "@/components/QrCode";
import { api } from "@/lib/client";

/**
 * Shows a one-time "scan to log in" QR (10 minutes, works once).
 * Front desk: pass clientId. Client: no clientId → logs them in on another device.
 */
export default function LoginQrButton({ clientId, clientName, label = "Login QR", className = "btn btn-sm btn-ghost" }: { clientId?: string; clientName?: string; label?: string; className?: string }) {
  const [qr, setQr] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    try {
      setQr(await api<{ url: string; expiresAt: string }>("/api/login-qr", { method: "POST", body: clientId ? { clientId } : {} }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>📱 {label}</button>
      {error && <span className="small" style={{ color: "var(--danger)" }}> {error}</span>}
      {qr && (
        <div role="dialog" aria-modal="true" aria-label="Login QR code" onClick={() => setQr(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,10,16,.55)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div className="card center" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, width: "100%" }}>
            <h3 style={{ marginBottom: 4 }}>{clientName ? `Login QR for ${clientName}` : "Log in on another device"}</h3>
            <p className="small muted">Scan with the phone camera. Works once, for 10 minutes.</p>
            <div style={{ display: "grid", placeItems: "center", margin: "12px 0" }}>
              <QrCode value={qr.url} size={240} label="One-time login QR code" />
            </div>
            <p className="small muted">Expires at {new Date(qr.expiresAt).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}. Only show this to the client in person.</p>
            <button className="btn btn-block" onClick={() => setQr(null)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
}
