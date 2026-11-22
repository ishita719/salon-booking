"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Recommendations } from "@/lib/recommend";
import { QUESTIONS, SkinAnswers } from "@/lib/skin";

type Draft = Partial<Record<keyof SkinAnswers, string | string[]>>;

/** The online skin & hair check: a short quiz, then a personal profile with matched treatments, products and offers. */
export default function SkinCheck({ initial }: { initial: Recommendations }) {
  const [data, setData] = useState<Recommendations>(initial);
  const [mode, setMode] = useState<"intro" | "quiz" | "result">(initial.hasProfile ? "result" : "intro");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>((initial.answers as Draft) ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = QUESTIONS[step];
  const value = draft[q.id];
  const answered = q.multi ? Array.isArray(value) && (value.length > 0 || q.id === "hairConcerns") : typeof value === "string";

  function pick(v: string) {
    if (q.multi) {
      const cur = Array.isArray(value) ? value : [];
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : cur.length < (q.max ?? 5) ? [...cur, v] : cur;
      setDraft({ ...draft, [q.id]: next });
    } else {
      setDraft({ ...draft, [q.id]: v });
      if (step < QUESTIONS.length - 1) setTimeout(() => setStep((s) => s + 1), 180);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const answers = { ...draft, hairConcerns: draft.hairConcerns ?? [] };
      setData(await api<Recommendations>("/api/skin-check", { method: "POST", body: { answers } }));
      setMode("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "intro")
    return (
      <div className="quiz card" style={{ padding: 36 }}>
        <div className="eyebrow">Free online skin &amp; hair check</div>
        <h1 style={{ fontSize: "2.2rem" }}>Let&apos;s get to know your skin</h1>
        <p className="lead">9 quick questions, about 2 minutes. You&apos;ll get your skin profile, a simple routine, the treatments that suit you best, product picks and your member offers.</p>
        <div className="row" style={{ margin: "18px 0" }}>
          <span className="tag">🕑 2 minutes</span>
          <span className="tag">🔒 Private to your account</span>
          <span className="tag">✦ Personal offers</span>
        </div>
        <button className="btn btn-lg" onClick={() => { setMode("quiz"); window.scrollTo({ top: 0 }); }}>Start the check</button>
        <p className="small muted" style={{ marginTop: 18, marginBottom: 0 }}>This is a guide, not a medical diagnosis. Your stylist confirms everything with a quick skin check at your visit.</p>
      </div>
    );

  if (mode === "quiz")
    return (
      <div className="quiz">
        <div className="spread small muted">
          <span>Question {step + 1} of {QUESTIONS.length}</span>
          <button className="linklike small" onClick={() => setMode(data.hasProfile ? "result" : "intro")}>Exit</button>
        </div>
        <div className="progress"><span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} /></div>
        <h2>{q.title}</h2>
        {q.help && <p className="muted">{q.help}</p>}
        <div className="opt-grid" role={q.multi ? "group" : "radiogroup"} aria-label={q.title}>
          {q.options.map((o) => {
            const on = q.multi ? Array.isArray(value) && value.includes(o.value) : value === o.value;
            return (
              <button key={o.value} type="button" className={`opt ${on ? "on" : ""}`} role={q.multi ? "checkbox" : "radio"} aria-checked={on} onClick={() => pick(o.value)}>
                <strong>{on ? "✓ " : ""}{o.label}</strong>
                {o.note && <span>{o.note}</span>}
              </button>
            );
          })}
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
        <div className="spread" style={{ marginTop: 26 }}>
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
          {step < QUESTIONS.length - 1 ? (
            <button className="btn" disabled={!answered} onClick={() => setStep(step + 1)}>Next →</button>
          ) : (
            <button className="btn" disabled={!answered || busy} onClick={submit}>{busy ? "Analysing…" : "See my results ✦"}</button>
          )}
        </div>
      </div>
    );

  const a = data.analysis!;
  return (
    <div className="stack">
      <section className="result-hero">
        <div className="spread" style={{ alignItems: "flex-start" }}>
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">Your skin profile</div>
            <h1 style={{ fontSize: "2.2rem" }}>{a.headline}</h1>
            <p className="lead" style={{ color: "var(--text)" }}>{a.summary}</p>
            <div className="tags">
              <span className="tag">Skin: {a.skinType}</span>
              <span className="tag">Sensitivity: {a.sensitivity}</span>
              {a.concernLabels.map((c) => <span key={c} className="tag tag-gold">{c}</span>)}
              <span className="tag">Hair: {a.hairType}</span>
              {a.hairConcernLabels.map((c) => <span key={c} className="tag tag-gold">{c}</span>)}
            </div>
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => { setStep(0); setMode("quiz"); window.scrollTo({ top: 0 }); }}>Retake check</button>
            <Link href="/book" className="btn btn-sm">Book a treatment</Link>
          </div>
        </div>
      </section>

      <section>
        <h2>Treatments we recommend</h2>
        {data.services.length === 0 ? (
          <p className="muted">Your skin sounds happy! A Signature Facial every 6–8 weeks will keep it that way.</p>
        ) : (
          <div className="grid">
            {data.services.map((s, i) => (
              <div key={s.id} className="card card-hover" style={{ display: "flex", flexDirection: "column" }}>
                {i === 0 && <span className="tag tag-gold" style={{ alignSelf: "flex-start", marginBottom: 8 }}>★ Best match</span>}
                <h3 style={{ marginBottom: 4 }}>{s.name}</h3>
                <div className="small muted">{s.category} · {s.durationLabel}</div>
                <p className="small" style={{ margin: "10px 0", flex: 1 }}>{s.description}</p>
                <div className="small muted">Good for: {s.reasons.join(", ")}</div>
                <div className="spread" style={{ marginTop: 12 }}>
                  <div>
                    {s.offerPriceLabel ? (<><span className="price-was">{s.priceLabel}</span><span className="price-now">{s.offerPriceLabel}</span></>) : <strong>{s.priceLabel}</strong>}
                    {s.offerTitle && <div className="small" style={{ color: "var(--gold)" }}>{s.offerTitle}</div>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Link href={`/services/${s.id}`} className="btn btn-sm btn-ghost">How it&apos;s done</Link>
                    <Link href={`/book?service=${s.id}`} className="btn btn-sm">Book</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ fontSize: "1.5rem" }}>Your daily routine</h2>
        <div className="routine">
          <div><strong>☀ Morning</strong><ol>{a.routine.am.map((x) => <li key={x}>{x}</li>)}</ol></div>
          <div><strong>☾ Evening</strong><ol>{a.routine.pm.map((x) => <li key={x}>{x}</li>)}</ol></div>
          {a.routine.weekly.length > 0 && <div><strong>✦ Weekly</strong><ol>{a.routine.weekly.map((x) => <li key={x}>{x}</li>)}</ol></div>}
        </div>
        {a.tips.length > 0 && (
          <div className="alert alert-gold small" style={{ marginTop: 16, marginBottom: 0 }}>
            <strong>Tips for you:</strong> {a.tips.join(" ")}
          </div>
        )}
      </section>

      <section>
        <div className="spread"><h2>Products for your skin &amp; hair</h2><Link href="/account/products" className="small">All products →</Link></div>
        <div className="grid">
          {data.products.map((p) => (
            <div key={p.id} className="card">
              <div className="spread"><span className="tag">{p.category}</span><strong>{p.priceLabel}</strong></div>
              <h3 style={{ margin: "10px 0 2px" }}>{p.name}</h3>
              <div className="small muted">{p.brand}</div>
              <p className="small" style={{ margin: "8px 0" }}>{p.description}</p>
              <div className="small"><strong>How to use:</strong> {p.howToUse}</div>
              <div className="small muted" style={{ marginTop: 6 }}>Matches: {p.reasons.join(", ")}</div>
            </div>
          ))}
        </div>
        <p className="small muted">Ask your stylist for these at your visit — they&apos;ll confirm what suits you.</p>
      </section>

      {data.offers.length > 0 && (
        <section>
          <h2>Offers for you</h2>
          <div className="grid">
            {data.offers.slice(0, 3).map((o, i) => (
              <div key={o.id} className={`offer-card ${i === 1 ? "alt" : i === 2 ? "gold" : ""}`}>
                <div className="big">{o.label}</div>
                <strong>{o.title}</strong>
                <p className="small" style={{ margin: "6px 0" }}>{o.description}</p>
                {o.forYou.length > 0 && <div className="small">✦ Applies to your picks: {o.forYou.join(", ")}</div>}
              </div>
            ))}
          </div>
          <p className="small muted">Offers are applied automatically when you book.</p>
        </section>
      )}
    </div>
  );
}
