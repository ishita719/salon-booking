"use client";

import { useCallback, useEffect, useState } from "react";
import Stars from "@/components/Stars";
import { api } from "@/lib/client";
import type { FeedbackDTO } from "@/lib/feedback";

/** Owner: all feedback (publish to home page, reply, remove). Staff: read-only reviews about them. */
export default function FeedbackBoard({ mode }: { mode: "owner" | "staff" }) {
  const owner = mode === "owner";
  const [list, setList] = useState<FeedbackDTO[] | null>(null);
  const [filter, setFilter] = useState<"all" | "public" | "low">("all");
  const [replying, setReplying] = useState<{ id: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ feedback: FeedbackDTO[] }>("/api/feedback");
    setList(r.feedback);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function patch(id: string, body: object) {
    try {
      await api(`/api/feedback/${id}`, { method: "PATCH", body });
      setReplying(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(f: FeedbackDTO) {
    if (!window.confirm(`Remove this ${f.rating}★ review from ${f.clientName}? It can't be undone.`)) return;
    try {
      await api(`/api/feedback/${f.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const all = list ?? [];
  const avg = all.length ? all.reduce((t, f) => t + f.rating, 0) / all.length : 0;
  const shown = all.filter((f) => (filter === "public" ? f.isPublic : filter === "low" ? f.rating <= 3 : true));

  return (
    <div className="container section">
      <div className="eyebrow">{owner ? "Owner" : "Staff"}</div>
      <h1>{owner ? "Client feedback" : "My reviews"}</h1>
      <p className="lead">{owner ? "Read every review, reply, and choose which ones appear on the home page." : "What clients said about their visits with you."}</p>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", margin: "20px 0" }}>
        <div className="stat-card"><div className="muted small">Average rating</div><div className="stat">{all.length ? avg.toFixed(1) : "—"}</div><Stars rating={avg} /></div>
        <div className="stat-card"><div className="muted small">Reviews</div><div className="stat">{all.length}</div></div>
        {[5, 4, 3].map((n) => (
          <div key={n} className="stat-card"><div className="muted small">{n}★ reviews</div><div className="stat">{all.filter((f) => f.rating === n).length}</div></div>
        ))}
      </div>

      {owner && (
        <div className="tabs">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
          <button className={filter === "public" ? "active" : ""} onClick={() => setFilter("public")}>On home page</button>
          <button className={filter === "low" ? "active" : ""} onClick={() => setFilter("low")}>Needs attention (3★ or less)</button>
        </div>
      )}

      {list === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="card center muted">No feedback here yet.</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {shown.map((f) => (
            <article key={f.id} className="card" style={{ borderColor: f.rating <= 2 ? "#e7c3c3" : undefined }}>
              <div className="spread">
                <Stars rating={f.rating} size="1.1rem" />
                <span className="small muted">{f.dateLabel}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>{f.clientName}</strong>
                {owner && f.clientEmail && <span className="small muted"> · <a href={`mailto:${f.clientEmail}`}>{f.clientEmail}</a></span>}
              </div>
              <div className="small muted">
                {f.visitLabel ? `Visit on ${f.visitLabel}` : "General feedback"}
                {owner && f.stylistName ? ` · with ${f.stylistName}` : ""}
              </div>
              {f.comment && <p style={{ margin: "10px 0" }}>{f.comment}</p>}
              {f.ownerReply && <div className="alert alert-info small" style={{ margin: "8px 0" }}><strong>Salon reply:</strong> {f.ownerReply}</div>}

              {owner && (
                <>
                  {replying?.id === f.id ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea maxLength={1000} value={replying.text} onChange={(e) => setReplying({ id: f.id, text: e.target.value })} placeholder="Write a public reply…" aria-label="Reply" />
                      <div className="row" style={{ marginTop: 8 }}>
                        <button className="btn btn-sm" onClick={() => patch(f.id, { ownerReply: replying.text })}>Save reply</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setReplying(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="row" style={{ marginTop: 10 }}>
                      <button className={`btn btn-sm ${f.isPublic ? "btn-gold" : "btn-ghost"}`} onClick={() => patch(f.id, { isPublic: !f.isPublic })}>
                        {f.isPublic ? "★ Shown on home page" : "Show on home page"}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setReplying({ id: f.id, text: f.ownerReply ?? "" })}>{f.ownerReply ? "Edit reply" : "Reply"}</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(f)}>Remove</button>
                    </div>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
