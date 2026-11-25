"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { analyzeScan, GUIDES, mergeSuggestions, ScanKind, ScanResult, SuggestedAnswers } from "@/lib/scan";

const KINDS: { kind: ScanKind; icon: string; label: string; for: string }[] = [
  { kind: "face", icon: "🙂", label: "Face", for: "facials & skincare" },
  { kind: "hair", icon: "💇", label: "Hair", for: "cuts, colour & hair treatments" },
  { kind: "hands", icon: "💅", label: "Hands & nails", for: "manicures & hand care" },
];

const FRAME_W = 360; // analysis size (3:4 frame); small = fast and private
const FRAME_H = 480;

/** Draws an image/video into a 3:4 frame (cover-cropped), then returns the guide area's pixels + a preview. */
function grab(source: CanvasImageSource, sw: number, sh: number, kind: ScanKind) {
  const frame = document.createElement("canvas");
  frame.width = FRAME_W;
  frame.height = FRAME_H;
  const ctx = frame.getContext("2d", { willReadFrequently: true })!;
  const scale = Math.max(FRAME_W / sw, FRAME_H / sh);
  const cw = FRAME_W / scale, ch = FRAME_H / scale;
  ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, FRAME_W, FRAME_H);
  const g = GUIDES[kind];
  const x = Math.round(g.x * FRAME_W), y = Math.round(g.y * FRAME_H), w = Math.round(g.w * FRAME_W), h = Math.round(g.h * FRAME_H);
  const img = ctx.getImageData(x, y, w, h);
  const preview = document.createElement("canvas");
  preview.width = w;
  preview.height = h;
  preview.getContext("2d")!.putImageData(img, 0, 0);
  return { pixels: { data: img.data, width: w, height: h }, preview: preview.toDataURL("image/jpeg", 0.8) };
}

/** Camera scans for face, hair and hands. Everything stays on this device; results become suggested quiz answers. */
export default function ScanStudio({ onContinue, onSkip }: { onContinue: (s: SuggestedAnswers, results: ScanResult[]) => void; onSkip: () => void }) {
  const [kind, setKind] = useState<ScanKind>("face");
  const [results, setResults] = useState<Partial<Record<ScanKind, ScanResult & { preview: string }>>>({});
  const [live, setLive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guide = GUIDES[kind];
  const current = results[kind];

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);
  useEffect(() => stop, [stop]); // always turn the camera off when leaving
  useEffect(() => {
    stop();
    setCamError(null);
  }, [kind, stop]);

  async function startCamera() {
    setCamError(null);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamError("The live camera needs a secure (https) connection. Use “Take or upload a photo” instead — it opens your camera too.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: guide.facing, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const name = (e as DOMException).name;
      setCamError(
        name === "NotAllowedError"
          ? "Camera permission was blocked. Allow the camera for this site in your browser settings, or use “Take or upload a photo”."
          : "We couldn't open a camera on this device. Use “Take or upload a photo” instead.",
      );
    }
  }

  function finish(pixels: { data: Uint8ClampedArray; width: number; height: number }, preview: string) {
    const r = analyzeScan(kind, pixels);
    setResults((prev) => ({ ...prev, [kind]: { ...r, preview } }));
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const { pixels, preview } = grab(v, v.videoWidth, v.videoHeight, kind);
    stop();
    finish(pixels, preview);
    setBusy(false);
  }

  async function fromFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setCamError("Please choose a photo.");
    setBusy(true);
    setCamError(null);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const { pixels, preview } = grab(img, img.naturalWidth, img.naturalHeight, kind);
      finish(pixels, preview);
    } catch {
      setCamError("We couldn't read that photo. Try another one (JPG or PNG).");
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  const done = Object.values(results).filter((r) => r?.ok) as ScanResult[];

  return (
    <div className="quiz" style={{ maxWidth: 760 }}>
      <div className="spread small muted">
        <span>📷 Camera scan</span>
        <button className="linklike small" onClick={() => { stop(); onSkip(); }}>Skip — answer questions instead</button>
      </div>
      <h2 style={{ marginTop: 8 }}>Scan your face, hair and hands</h2>
      <p className="muted" style={{ marginTop: 0 }}>Do one or all three. We&apos;ll suggest your answers and the best treatments and products. 🔒 Photos stay on this phone — they&apos;re analysed here and never uploaded or saved.</p>

      <div className="scan-tabs" role="tablist" aria-label="What to scan">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" role="tab" aria-selected={kind === k.kind} className={`scan-tab ${kind === k.kind ? "on" : ""}`} onClick={() => setKind(k.kind)}>
            <span aria-hidden="true">{results[k.kind]?.ok ? "✅" : k.icon}</span>
            <strong>{k.label}</strong>
            <small>{k.for}</small>
          </button>
        ))}
      </div>

      <div className="scan-grid">
        <div>
          <div className="scan-frame">
            {live ? (
              <video ref={videoRef} playsInline muted className={guide.facing === "user" ? "mirror" : ""} aria-label="Camera preview" />
            ) : current?.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.preview} alt="Your scanned photo" className="scan-shot" style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }} />
            ) : (
              <div className="scan-empty">{KINDS.find((k) => k.kind === kind)!.icon}</div>
            )}
            <div className={`scan-guide ${guide.shape}`} style={{ left: `${guide.x * 100}%`, top: `${guide.y * 100}%`, width: `${guide.w * 100}%`, height: `${guide.h * 100}%` }} aria-hidden="true" />
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>{guide.tip}</p>
          <div className="row" style={{ gap: 8 }}>
            {live ? (
              <>
                <button className="btn" onClick={capture} disabled={busy}>📸 Capture</button>
                <button className="btn btn-ghost" onClick={stop}>Cancel</button>
              </>
            ) : (
              <>
                <button className="btn" onClick={startCamera}>{current ? "Scan again" : "Open camera"}</button>
                <button className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>Take or upload a photo</button>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture={guide.facing} onChange={fromFile} hidden />
          </div>
          {camError && <div className="alert alert-gold small" style={{ marginTop: 12 }}>{camError}</div>}
        </div>

        <div aria-live="polite">
          {busy && <p className="muted">Analysing…</p>}
          {current && !current.ok && <div className="alert alert-error">{current.problem}</div>}
          {current?.ok && (
            <div className="card-flat">
              <div className="eyebrow">Scan result</div>
              <h3 style={{ margin: "4px 0 12px" }}>{current.headline}</h3>
              {current.findings.map((f) => (
                <div key={f.key} className="scan-meter">
                  <div className="spread small"><strong>{f.label}</strong><span className="muted">{f.score}/100</span></div>
                  <div className="meter"><span style={{ width: `${f.score}%` }} /></div>
                  <div className="small muted">{f.text}</div>
                </div>
              ))}
              <p className="small muted" style={{ marginBottom: 0 }}>An estimate from one photo — lighting and camera affect it. You can change any answer next.</p>
            </div>
          )}
          {!current && !busy && (
            <div className="card-flat small muted">
              <strong style={{ color: "var(--text)" }}>What we look at</strong>
              <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                {kind === "face" && <><li>Oil &amp; shine (T-zone vs cheeks) → oily, dry, combination or normal</li><li>Pores &amp; texture, redness, spots, radiance</li></>}
                {kind === "hair" && <><li>Curl pattern (straight, wavy, curly, coily)</li><li>Frizz, shine &amp; dryness, grey or fashion colour, scalp showing</li></>}
                {kind === "hands" && <><li>Dry skin &amp; cuticles</li><li>Polish — time for a fresh manicure?</li></>}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="spread" style={{ marginTop: 26 }}>
        <span className="small muted">{done.length ? `${done.length} of 3 scanned` : "Scan at least one to continue, or skip."}</span>
        <button className="btn" disabled={!done.length} onClick={() => { stop(); onContinue(mergeSuggestions(done), done); }}>Continue — check my answers →</button>
      </div>
    </div>
  );
}
