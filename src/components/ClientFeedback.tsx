"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Stars from "@/components/Stars";
import { api } from "@/lib/client";
import type { FeedbackDTO } from "@/lib/feedback";

const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent!"];

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="row" style={{ gap: 12 }}>
      <div className="star-input" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} star${i > 1 ? "s" : ""}`} className={i <= shown ? "on" : ""} onMouseEnter={() => setHover(i)} onClick={() => onChange(i)}>
            ★
          </button>
        ))}
      </div>
      <span className="muted">{LABELS[shown]}</span>
    </div>
  );
}

/** Client: rate a visit or send general feedback, and see past feedback + salon replies. */
export default function ClientFeedback() {
  const [list, setList] = useState<FeedbackDTO[] | null>(null);
  const [toReview, setToReview] = useState<{ id: string; label: string; stylistName: string | null }[]>([]);
  const [rating, setRating] = useState(0);
  const [appointmentId, setAppointmentId] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ feedback: FeedbackDTO[]; toReview: { id: string; label: string; stylistName: string | null }[] }>("/api/feedback");
    setList(r.feedback);
    setToReview(r.toReview);
    return r;
  }, []);

  useEffect(() => {
    load()
      .then((r) => {
        const pre = new URLSearchParams(window.location.search).get("appointment");
        if (pre && r.toReview.some((v) => v.id === pre)) setAppointmentId(pre);
      })
      .catch((e) => setFlash({ kind: "error", text: e.message }));
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!rating) return setFlash({ kind: "error", text: "Tap the stars to choose a rating." });
    setBusy(true);
    setFlash(null);
    try {
      await api("/api/feedback", { method: "POST", body: { rating, comment, appointmentId: appointmentId || null } });
      setFlash({ kind: "ok", text: "Thank you! Your feedback has been sent to the salon." });
      setRating(0);
      setComment("");
      setAppointmentId("");
      await load();
    } catch (err) {
      setFlash({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section">
      <div className="eyebrow">Your voice matters</div>
      <h1>Feedback</h1>
      <p className="lead">Tell us how your visit went — the owner reads every message.</p>

      <div className="dash-cols" style={{ marginTop: 24 }}>
        <form className="card" onSubmit={submit}>
          <h2 style={{ fontSize: "1.4rem" }}>Leave feedback</h2>
          {flash && <div className={`alert alert-${flash.kind}`} role="status">{flash.text}</div>}
          <div className="field">
            <label htmlFor="visit">Which visit?</label>
            <select id="visit" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
              <option value="">General feedback (not about one visit)</option>
              {toReview.map((v) => (
                <option key={v.id} value={v.id}>{v.label}{v.stylistName ? ` — ${v.stylistName}` : ""}</option>
              ))}
            </select>
            {toReview.length === 0 && <div className="hint">Visits appear here after they&apos;ve happened.</div>}
          </div>
          <div className="field">
            <label>Your rating</label>
            <StarInput value={rating} onChange={setRating} />
          </div>
          <div className="field">
            <label htmlFor="comment">Comments</label>
            <textarea id="comment" maxLength={1000} placeholder="What did you love? What could we do better?" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
        </form>

        <section className="card">
          <h2 style={{ fontSize: "1.4rem" }}>Your feedback</h2>
          {list === null ? (
            <p className="muted">Loading…</p>
          ) : list.length === 0 ? (
            <p className="muted">Nothing yet. <Link href="/book">Book a visit</Link> and tell us how it went!</p>
          ) : (
            list.map((f) => (
              <div key={f.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
                <div className="spread"><Stars rating={f.rating} /><span className="small muted">{f.dateLabel}</span></div>
                {f.visitLabel && <div className="small muted">Visit on {f.visitLabel}{f.stylistName ? ` with ${f.stylistName}` : ""}</div>}
                {f.comment && <p style={{ margin: "6px 0" }}>{f.comment}</p>}
                {f.ownerReply && <div className="alert alert-info small" style={{ margin: "8px 0 0" }}><strong>Salon reply:</strong> {f.ownerReply}</div>}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
