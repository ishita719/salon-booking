"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import GalleryGrid, { GalleryItem } from "@/components/GalleryGrid";
import { api } from "@/lib/client";

/** Shrinks a photo in the browser (max 1200px, JPEG) so uploads are small and fast. */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file isn't a supported image."));
      i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = 0.82;
    let out = canvas.toDataURL("image/jpeg", q);
    while (out.length > 900_000 && q > 0.4) out = canvas.toDataURL("image/jpeg", (q -= 0.1));
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Item = GalleryItem & { sort: number };
const CATS = ["Hair", "Colour", "Skin", "Nails", "Treatments", "Bridal & Events"];

export default function GalleryManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<{ id?: string; title: string; category: string; description: string; image?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setItems((await api<{ items: Item[] }>("/api/gallery")).items), []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function onFile(f: File | undefined) {
    if (!f || !draft) return;
    try {
      setDraft({ ...draft, image: await compress(f) });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const { id, ...body } = draft;
    try {
      await api(id ? `/api/gallery/${id}` : "/api/gallery", { method: id ? "PATCH" : "POST", body: { ...body, ...(body.image === undefined ? {} : { image: body.image }) } });
      setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(g: Item) {
    if (!window.confirm(`Remove "${g.title}" from the gallery?`)) return;
    await api(`/api/gallery/${g.id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    await load();
  }

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      <div className="spread">
        <div>
          <h1>Gallery</h1>
          <p className="muted">Show off your work on the home page and the &quot;Our work&quot; page. Photos are resized automatically.</p>
        </div>
        <button className="btn" onClick={() => setDraft({ title: "", category: "Hair", description: "" })}>Add photo</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {draft && (
        <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.4rem" }}>{draft.id ? "Edit photo" : "New photo"}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="field"><label htmlFor="g-title">Title</label><input id="g-title" type="text" required maxLength={80} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="field">
              <label htmlFor="g-cat">Category</label>
              <select id="g-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <div className="field">
              <label htmlFor="g-file">Photo</label>
              <input id="g-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
              <div className="hint">JPG, PNG or WebP. Get the client&apos;s permission before posting their photo.</div>
            </div>
          </div>
          <div className="field"><label htmlFor="g-desc">Short description</label><input id="g-desc" type="text" maxLength={300} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          {draft.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.image} alt="Preview" style={{ maxWidth: 220, borderRadius: 12, marginBottom: 12, display: "block" }} />
          )}
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <GalleryGrid items={items} />
      <div className="card table-wrap" style={{ padding: 8, marginTop: 20 }}>
        <table>
          <thead><tr><th>Title</th><th>Category</th><th>Photo</th><th></th></tr></thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id}>
                <td><strong>{g.title}</strong><div className="small muted">{g.description}</div></td>
                <td>{g.category}</td>
                <td>{g.hasImage ? "✓ Uploaded" : <span className="muted">Illustration (no photo yet)</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft({ id: g.id, title: g.title, category: g.category, description: g.description })}>Edit / add photo</button>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(g)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
