"use client";

// User rewards hub: points balance, redeemable catalog, manual code entry, and
// redemption history. Point operations go through Cloud Functions; reads are
// rule-gated Firestore listeners. Styled with Activelyte tokens.

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  listenLoyalty,
  listActiveRewards,
  listenMyRedemptions,
  redeemReward,
  scanCode,
} from "@/lib/services/reward-service";
import type { LoyaltyAccount, Redemption, Reward } from "@/lib/types/models";

export function RewardsViewLive() {
  const { user } = useAuth();
  const uid = user?.uid;
  const org = user?.organizationId;

  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [code, setCode] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return listenLoyalty(uid, setAccount);
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    return listenMyRedemptions(uid, setRedemptions);
  }, [uid]);
  useEffect(() => {
    if (!org) return;
    listActiveRewards(org).then(setRewards).catch(() => {});
  }, [org]);

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const balance = account?.balance ?? 0;

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy("scan");
    try {
      const r = await scanCode(c);
      flash("ok", r.replay ? "Already scanned." : `+${r.pointsAwarded} points!`);
      setCode("");
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Couldn't redeem that code.");
    } finally {
      setBusy(null);
    }
  };

  const doRedeem = async (r: Reward) => {
    setBusy(r.id);
    try {
      const res = await redeemReward(r.id);
      flash("ok", res.status === "pending" ? "Requested — awaiting approval." : "Redeemed!");
      // refresh catalog (inventory may have changed)
      if (org) listActiveRewards(org).then(setRewards).catch(() => {});
    } catch (err) {
      flash("err", err instanceof Error ? err.message : "Redemption failed.");
    } finally {
      setBusy(null);
    }
  };

  if (!org) {
    return (
      <div className="rw-nostate">
        <style>{css}</style>
        <p className="rw-nostate-t">Rewards</p>
        <p className="rw-nostate-s">Rewards are for organization members. Ask an admin to add you.</p>
      </div>
    );
  }

  return (
    <div className="rw">
      <style>{css}</style>

      {toast && <div className={`rw-toast ${toast.kind}`}>{toast.msg}</div>}

      <div className="rw-balance">
        <div className="rw-bal-main">
          <span className="rw-bal-num">{balance.toLocaleString()}</span>
          <span className="rw-bal-lbl">Points</span>
        </div>
        <div className="rw-bal-life">
          Lifetime earned: {(account?.lifetimeEarned ?? 0).toLocaleString()}
        </div>
      </div>

      <form className="rw-scan" onSubmit={submitCode}>
        <input
          type="text"
          placeholder="Enter a reward code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" disabled={busy === "scan" || !code.trim()}>
          {busy === "scan" ? "…" : "Redeem"}
        </button>
      </form>
      <p className="rw-scan-hint">…or tap SCAN in the bottom bar to scan a QR code.</p>

      <h2 className="rw-h">Rewards</h2>
      {rewards.length === 0 ? (
        <div className="rw-empty">No rewards available yet.</div>
      ) : (
        <ul className="rw-grid">
          {rewards.map((r) => {
            const affordable = balance >= r.pointsRequired;
            const out = typeof r.inventory === "number" && r.inventory <= 0;
            return (
              <li key={r.id} className="rw-card">
                <div className="rw-card-body">
                  <div className="rw-card-title">{r.title}</div>
                  {r.description && <div className="rw-card-desc">{r.description}</div>}
                  <div className="rw-card-cost">{r.pointsRequired.toLocaleString()} pts</div>
                </div>
                <button
                  className="rw-redeem"
                  disabled={!affordable || out || busy === r.id}
                  onClick={() => doRedeem(r)}
                >
                  {out ? "Out of stock" : busy === r.id ? "…" : affordable ? "Redeem" : "Not enough"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="rw-h">Your redemptions</h2>
      {redemptions.length === 0 ? (
        <div className="rw-empty">No redemptions yet.</div>
      ) : (
        <ul className="rw-hist">
          {redemptions
            .slice()
            .sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
            .map((r) => (
              <li key={r.id}>
                <span className="rw-hist-title">{r.rewardTitle}</span>
                <span className="rw-hist-pts">−{r.pointsSpent}</span>
                <span className={`rw-status ${r.status}`}>{r.status}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function millis(v: unknown): number {
  return v && typeof (v as { toMillis?: () => number }).toMillis === "function"
    ? (v as { toMillis: () => number }).toMillis()
    : 0;
}

const css = `
  .rw{max-width:720px;margin:0 auto;padding:18px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .rw-toast{position:fixed;left:50%;top:calc(var(--top-header-h,56px) + 12px);transform:translateX(-50%);
    z-index:120;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid}
  .rw-toast.ok{background:rgba(31,138,104,.18);border-color:#1F8A68;color:#61d3a8}
  .rw-toast.err{background:rgba(255,90,60,.12);border-color:rgba(255,90,60,.5);color:#ff9c7a}

  .rw-balance{border:2px solid #F5852A;border-radius:10px;padding:18px 20px;text-align:center;
    background:linear-gradient(180deg,rgba(90,46,8,.5),rgba(24,14,5,.3)),#0a0a0a;margin-bottom:16px}
  .rw-bal-main{display:flex;align-items:baseline;justify-content:center;gap:10px}
  .rw-bal-num{font-family:'Chakra Petch','Saira',sans-serif;font-size:44px;font-weight:700;color:#F5852A;line-height:1}
  .rw-bal-lbl{font-size:16px;letter-spacing:3px;text-transform:uppercase;color:#cfcfcf}
  .rw-bal-life{margin-top:6px;font-size:12px;color:#8C8C8C;letter-spacing:1px;text-transform:uppercase}

  .rw-scan{display:flex;gap:8px}
  .rw-scan input{flex:1;height:44px;padding:0 14px;background:#0c0c0c;border:1.5px solid #333;border-radius:6px;
    color:#F2F2F2;font-family:inherit;font-size:15px;outline:none}
  .rw-scan input:focus{border-color:#F5852A}
  .rw-scan button{height:44px;padding:0 20px;border:none;border-radius:6px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .rw-scan button:disabled{opacity:.5}
  .rw-scan-hint{font-size:12px;color:#7C7C7C;margin:6px 2px 0}

  .rw-h{font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C8C8C;
    margin:24px 0 10px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:6px}
  .rw-empty{color:#7C7C7C;font-size:14px;padding:10px 2px}

  .rw-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
  .rw-card{border:1.5px solid #2a2a2a;border-radius:8px;padding:14px;display:flex;flex-direction:column;
    justify-content:space-between;background:#0a0a0a;min-height:130px}
  .rw-card-title{font-size:16px;font-weight:600}
  .rw-card-desc{font-size:12px;color:#8C8C8C;margin-top:3px}
  .rw-card-cost{margin-top:10px;font-size:15px;font-weight:700;color:#F5852A}
  .rw-redeem{margin-top:12px;height:38px;border:none;border-radius:6px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .rw-redeem:disabled{opacity:.4;cursor:default;background:#333;color:#8C8C8C}

  .rw-hist{list-style:none;margin:0;padding:0}
  .rw-hist li{display:flex;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid rgba(255,255,255,.06)}
  .rw-hist-title{flex:1;font-size:14px}
  .rw-hist-pts{font-size:14px;color:#ff9c7a;font-weight:600}
  .rw-status{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:3px;border:1px solid}
  .rw-status.approved{color:#61d3a8;border-color:rgba(31,138,104,.5)}
  .rw-status.pending{color:#EBD82E;border-color:rgba(235,216,46,.4)}
  .rw-status.rejected,.rw-status.cancelled{color:#ff8a5c;border-color:rgba(255,90,60,.4)}

  .rw-nostate{display:flex;flex-direction:column;align-items:center;justify-content:center;height:55vh;text-align:center;gap:8px;padding:20px}
  .rw-nostate-t{font-size:20px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .rw-nostate-s{max-width:320px;line-height:1.5;color:#8C8C8C;margin:0}
`;
