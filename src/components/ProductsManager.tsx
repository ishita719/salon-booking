"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import TargetPicker from "@/components/TargetPicker";
import { api } from "@/lib/client";
import { TARGETS, Target } from "@/lib/skin";
import { formatMoney } from "@/lib/time";

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  howToUse: string;
  priceCents: number;
  targets: string;
  active: boolean;
}
type Draft = Omit<Product, "id" | "targets"> & { id?: string; targets: string[] };
const EMPTY: Draft = { name: "", brand: "Maple & Mane Botanics", category: "Serum", description: "", howToUse: "", priceCents: 3000, targets: [], active: true };

export default function ProductsManager() {
  const [list, setList] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList((await api<{ products: Product[] }>("/api/products?all=1")).products);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const { id, ...body } = draft;
    try {
      await api(id ? `/api/products/${id}` : "/api/products", { method: id ? "PATCH" : "POST", body });
      setDraft(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(p: Product) {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="container" style={{ paddingBottom: 48 }}>
      <div className="spread">
        <div>
          <h1>Products</h1>
          <p className="muted">Products are recommended to clients after their skin check. Tick what each one is good for.</p>
        </div>
        <button className="btn" onClick={() => setDraft({ ...EMPTY })}>Add product</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      {draft && (
        <form className="card" onSubmit={save} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: "1.4rem" }}>{draft.id ? "Edit product" : "New product"}</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="field"><label htmlFor="p-name">Name</label><input id="p-name" type="text" required maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-brand">Brand</label><input id="p-brand" type="text" maxLength={60} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-cat">Category</label><input id="p-cat" type="text" required maxLength={40} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
            <div className="field"><label htmlFor="p-price">Price (CAD)</label><input id="p-price" type="number" min={0} step={0.01} required value={draft.priceCents / 100} onChange={(e) => setDraft({ ...draft, priceCents: Math.round(Number(e.target.value) * 100) })} /></div>
          </div>
          <div className="field"><label htmlFor="p-desc">Description</label><textarea id="p-desc" maxLength={400} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="field"><label htmlFor="p-how">How to use</label><textarea id="p-how" maxLength={400} value={draft.howToUse} onChange={(e) => setDraft({ ...draft, howToUse: e.target.value })} /></div>
          <div className="field"><label>Good for</label><TargetPicker value={draft.targets} onChange={(t) => setDraft({ ...draft, targets: t })} /></div>
          <label className="choice" style={{ padding: 10, display: "inline-flex", marginBottom: 16 }}><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Visible to clients</label>
          <div className="row">
            <button className="btn">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap" style={{ padding: 8 }}>
        <table>
          <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Good for</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.5 }}>
                <td><strong>{p.name}</strong><div className="small muted">{p.brand}</div></td>
                <td>{p.category}</td>
                <td>{formatMoney(p.priceCents)}</td>
                <td className="small">{p.targets.split(",").filter(Boolean).map((t) => TARGETS[t as Target] ?? t).join(", ")}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDraft({ ...p, targets: p.targets.split(",").filter(Boolean) })}>Edit</button>{" "}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
