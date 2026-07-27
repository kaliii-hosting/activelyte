"use client";

// Admin catalog: products (+ unique reward codes), rewards, and pending
// redemption approvals. Management writes go through the admin API (Admin SDK);
// redemption decisions go through the decideRedemption callable.

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { decideRedemption } from "@/lib/services/reward-service";

type Product = { id: string; name: string; barcode?: string; rewardPoints: number; status: string; perUserDailyLimit?: number };
type Reward = { id: string; title: string; pointsRequired: number; active: boolean; inventory?: number; requiresApproval?: boolean };
type Redemption = { id: string; rewardTitle: string; userId: string; pointsSpent: number; status: string };

export function CatalogManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pending, setPending] = useState<Redemption[]>([]);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);

  const flash = (k: "ok" | "err", t: string) => {
    setMsg({ k, t });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [p, r, red] = await Promise.all([
        apiFetch<{ products: Product[] }>("/api/admin/products"),
        apiFetch<{ rewards: Reward[] }>("/api/admin/rewards"),
        apiFetch<{ redemptions: Redemption[] }>("/api/admin/redemptions?pending=1"),
      ]);
      setProducts(p.products);
      setRewards(r.rewards);
      setPending(red.redemptions);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed to load catalog.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await decideRedemption(id, decision);
      flash("ok", `Redemption ${decision === "approve" ? "approved" : "rejected"}.`);
      void load();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed.");
    }
  };

  return (
    <section className="cat">
      <style>{css}</style>
      <div className="cat-head"><h1>Catalog</h1><p>Products, reward codes, rewards & approvals.</p></div>
      {msg && <div className={`cat-alert ${msg.k}`}>{msg.t}</div>}

      {pending.length > 0 && (
        <>
          <h2 className="cat-h">Pending approvals ({pending.length})</h2>
          <ul className="cat-list">
            {pending.map((r) => (
              <li key={r.id} className="cat-row">
                <span className="cat-row-main">{r.rewardTitle} · −{r.pointsSpent} pts</span>
                <button className="cat-approve" onClick={() => decide(r.id, "approve")}>Approve</button>
                <button className="cat-reject" onClick={() => decide(r.id, "reject")}>Reject</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="cat-h">Products</h2>
      <CreateProduct onDone={(m) => { flash("ok", m); void load(); }} onErr={(m) => flash("err", m)} />
      <ul className="cat-list">
        {products.length === 0 && <li className="cat-empty">No products yet.</li>}
        {products.map((p) => (
          <ProductRow key={p.id} product={p} onDone={(m) => { flash("ok", m); void load(); }} onErr={(m) => flash("err", m)} />
        ))}
      </ul>

      <h2 className="cat-h">Rewards</h2>
      <CreateReward onDone={(m) => { flash("ok", m); void load(); }} onErr={(m) => flash("err", m)} />
      <ul className="cat-list">
        {rewards.length === 0 && <li className="cat-empty">No rewards yet.</li>}
        {rewards.map((r) => (
          <li key={r.id} className="cat-row">
            <span className="cat-row-main">
              {r.title} · {r.pointsRequired} pts
              {typeof r.inventory === "number" ? ` · ${r.inventory} left` : ""}
              {r.requiresApproval ? " · approval" : ""}
            </span>
            <span className={`cat-badge ${r.active ? "on" : "off"}`}>{r.active ? "active" : "off"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateProduct({ onDone, onErr }: { onDone: (m: string) => void; onErr: (m: string) => void }) {
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [points, setPoints] = useState("10");
  const [limit, setLimit] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/products", { method: "POST", body: {
        name: name.trim(), barcode: barcode.trim() || undefined,
        rewardPoints: Number(points) || 0,
        perUserDailyLimit: limit ? Number(limit) : undefined,
      }});
      onDone(`Created product “${name.trim()}”.`);
      setName(""); setBarcode(""); setPoints("10"); setLimit("");
    } catch (e) { onErr(e instanceof Error ? e.message : "Failed."); }
  };
  return (
    <form className="cat-form" onSubmit={submit}>
      <input placeholder="Product name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input placeholder="Barcode (UPC/EAN)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      <input type="number" min="0" placeholder="Points" value={points} onChange={(e) => setPoints(e.target.value)} style={{ maxWidth: 90 }} />
      <input type="number" min="1" placeholder="Daily limit" value={limit} onChange={(e) => setLimit(e.target.value)} style={{ maxWidth: 110 }} />
      <button type="submit" disabled={name.trim().length < 2}>Add</button>
    </form>
  );
}

function ProductRow({ product, onDone, onErr }: { product: Product; onDone: (m: string) => void; onErr: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState("");
  const [pts, setPts] = useState(String(product.rewardPoints || 10));
  const addCodes = async () => {
    const list = codes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    try {
      const res = await apiFetch<{ created: number }>("/api/admin/products/codes", { method: "POST", body: {
        productId: product.id, points: Number(pts) || 0, codes: list,
      }});
      onDone(`Added ${res.created} unique codes.`);
      setCodes(""); setOpen(false);
    } catch (e) { onErr(e instanceof Error ? e.message : "Failed."); }
  };
  return (
    <li className="cat-row col">
      <div className="cat-row-line">
        <span className="cat-row-main">
          {product.name} · {product.rewardPoints} pts
          {product.barcode ? ` · ${product.barcode}` : ""}
          {product.perUserDailyLimit ? ` · ${product.perUserDailyLimit}/day` : ""}
        </span>
        <button className="cat-mini" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "+ Codes"}</button>
      </div>
      {open && (
        <div className="cat-codes">
          <textarea placeholder="Unique codes (one per line or comma-separated) — stored hashed" value={codes} onChange={(e) => setCodes(e.target.value)} rows={3} />
          <div className="cat-codes-row">
            <input type="number" min="0" value={pts} onChange={(e) => setPts(e.target.value)} style={{ maxWidth: 90 }} />
            <button onClick={addCodes} disabled={!codes.trim()}>Register codes</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateReward({ onDone, onErr }: { onDone: (m: string) => void; onErr: (m: string) => void }) {
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("100");
  const [inventory, setInventory] = useState("");
  const [approval, setApproval] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/api/admin/rewards", { method: "POST", body: {
        title: title.trim(), pointsRequired: Number(points) || 0,
        inventory: inventory ? Number(inventory) : undefined, requiresApproval: approval,
      }});
      onDone(`Created reward “${title.trim()}”.`);
      setTitle(""); setPoints("100"); setInventory(""); setApproval(false);
    } catch (e) { onErr(e instanceof Error ? e.message : "Failed."); }
  };
  return (
    <form className="cat-form" onSubmit={submit}>
      <input placeholder="Reward title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input type="number" min="0" placeholder="Points" value={points} onChange={(e) => setPoints(e.target.value)} style={{ maxWidth: 100 }} />
      <input type="number" min="0" placeholder="Stock" value={inventory} onChange={(e) => setInventory(e.target.value)} style={{ maxWidth: 90 }} />
      <label className="cat-check"><input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} /> approval</label>
      <button type="submit" disabled={title.trim().length < 2}>Add</button>
    </form>
  );
}

const css = `
  .cat{max-width:760px;margin:0 auto;padding:20px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .cat-head h1{font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .cat-head p{color:#8C8C8C;font-size:14px;margin:4px 0 8px}
  .cat-alert{margin:8px 0;padding:10px 12px;border-radius:5px;font-size:13px;border:1px solid}
  .cat-alert.ok{background:rgba(31,138,104,.12);border-color:rgba(31,138,104,.5);color:#61d3a8}
  .cat-alert.err{background:rgba(255,90,60,.08);border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .cat-h{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C8C8C;
    margin:22px 0 10px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:6px}
  .cat-form{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
  .cat-form input[type=text],.cat-form input:not([type]){flex:1 1 140px}
  .cat-form input{height:40px;padding:0 12px;background:#0c0c0c;border:1.5px solid #333;border-radius:5px;
    color:#F2F2F2;font-family:inherit;font-size:14px;outline:none;flex:1 1 120px}
  .cat-form input:focus{border-color:#F5852A}
  .cat-form button{height:40px;padding:0 18px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .cat-form button:disabled{opacity:.5}
  .cat-check{display:flex;align-items:center;gap:5px;font-size:12px;color:#8C8C8C}
  .cat-list{list-style:none;margin:0 0 6px;padding:0}
  .cat-row{display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid rgba(255,255,255,.06)}
  .cat-row.col{flex-direction:column;align-items:stretch}
  .cat-row-line{display:flex;align-items:center;gap:10px}
  .cat-row-main{flex:1;font-size:14px}
  .cat-empty{color:#7C7C7C;font-size:14px;padding:8px 4px}
  .cat-badge{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1px solid}
  .cat-badge.on{color:#61d3a8;border-color:rgba(31,138,104,.5)}
  .cat-badge.off{color:#8C8C8C;border-color:#4A4A4A}
  .cat-approve,.cat-reject,.cat-mini{height:32px;padding:0 12px;border-radius:5px;font-family:inherit;font-size:12px;
    font-weight:600;letter-spacing:1px;cursor:pointer;border:1.5px solid}
  .cat-approve{background:none;border-color:rgba(31,138,104,.5);color:#61d3a8}
  .cat-reject{background:none;border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .cat-mini{background:none;border-color:#4A4A4A;color:#F0842E}
  .cat-codes{margin:8px 0 4px;display:flex;flex-direction:column;gap:8px}
  .cat-codes textarea{background:#0c0c0c;border:1.5px solid #333;border-radius:5px;color:#F2F2F2;
    font-family:inherit;font-size:13px;padding:8px 10px;outline:none;resize:vertical}
  .cat-codes textarea:focus{border-color:#F5852A}
  .cat-codes-row{display:flex;gap:8px}
  .cat-codes-row input{height:36px;padding:0 10px;background:#0c0c0c;border:1.5px solid #333;border-radius:5px;color:#F2F2F2;font-family:inherit}
  .cat-codes-row button{height:36px;padding:0 16px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer}
  .cat-codes-row button:disabled{opacity:.5}
`;
