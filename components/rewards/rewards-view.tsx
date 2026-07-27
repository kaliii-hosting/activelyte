"use client";

// Rewards page — NEW DESIGN (demo content while the design is finalized).
// Presentational only: balance, tier progress, quick actions, featured rewards,
// and recent activity. Wire to the real reward engine later (see the preserved
// rewards-view-live.tsx for the working data hooks: listenLoyalty,
// listActiveRewards, redeemReward, scanCode, listenMyRedemptions).

import React from "react";

const balance = 2450;
const tier = { name: "Gold", toNext: 550, next: "Platinum", current: 2450, ceiling: 3000 };

const FEATURED = [
  { id: "off5", title: "$5 OFF", sub: "ON YOUR NEXT ORDER", pts: 500, icon: "ticket" },
  { id: "drink", title: "FREE DRINK", sub: "ANY BEVERAGE", pts: 700, icon: "cup" },
  { id: "vip", title: "VIP ENTRY", sub: "SKIP THE LINE", pts: 1200, icon: "vip" },
] as const;

const ACTIVITY = [
  { id: "a1", kind: "scan", title: "PURCHASE SCAN", when: "TODAY • 10:24 AM", delta: 50 },
  { id: "a2", kind: "gift", title: "REWARD REDEEMED", when: "MAY 31 • 08:15 PM", delta: -300 },
  { id: "a3", kind: "bonus", title: "BONUS CHECK-IN", when: "MAY 31 • 12:05 PM", delta: 25 },
] as const;

export function RewardsView() {
  const pct = Math.min(100, Math.round((tier.current / tier.ceiling) * 100));

  return (
    <div className="rx">
      <style>{css}</style>

      {/* ---- Balance hero ---- */}
      <div className="rx-hero">
        <div className="rx-hero-inner">
          <span className="rx-star" aria-hidden>
            <svg viewBox="0 0 100 100">
              <polygon
                className="rx-oct"
                points="30,6 70,6 94,30 94,70 70,94 30,94 6,70 6,30"
              />
              <path
                className="rx-spark"
                d="M50 20 C52 40 60 48 80 50 C60 52 52 60 50 80 C48 60 40 52 20 50 C40 48 48 40 50 20 Z"
              />
            </svg>
          </span>
          <div className="rx-hero-txt">
            <div className="rx-bal">
              <span className="rx-bal-num">{balance.toLocaleString()}</span>
              <span className="rx-bal-pts">PTS</span>
            </div>
            <div className="rx-bal-lbl">Available Rewards Balance</div>
          </div>
        </div>
      </div>

      {/* ---- Tier progress ---- */}
      <div className="rx-tier">
        <div className="rx-tier-top">
          <span className="rx-hex" aria-hidden>
            <svg viewBox="0 0 100 100">
              <polygon
                className="rx-hex-shape"
                points="50,5 91,28 91,72 50,95 9,72 9,28"
              />
              <path
                className="rx-hex-star"
                d="M50 30 l6.5 13.2 14.6 2.1 -10.5 10.3 2.5 14.5 -13.1 -6.9 -13.1 6.9 2.5 -14.5 -10.5 -10.3 14.6 -2.1z"
              />
            </svg>
          </span>
          <div className="rx-tier-name">
            <div className="rx-tier-h">{tier.name} Tier</div>
            <div className="rx-tier-sub">Exclusive Benefits</div>
          </div>
          <div className="rx-tier-next">
            <b>{tier.toNext} PTS</b> TO {tier.next.toUpperCase()}
          </div>
        </div>
        <div className="rx-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="rx-bar-legend">
          <span className="lit">{tier.current.toLocaleString()} PTS</span>
          <span className="dim">{tier.ceiling.toLocaleString()} PTS</span>
        </div>
      </div>

      {/* ---- Quick actions ---- */}
      <div className="rx-actions">
        <button className="rx-act">
          <span className="rx-act-ic">{IC.scan}</span>
          <span className="rx-act-t">Scan to Earn</span>
          <span className="rx-act-s">Earn points instantly</span>
        </button>
        <button className="rx-act">
          <span className="rx-act-ic">{IC.gift}</span>
          <span className="rx-act-t">Redeem</span>
          <span className="rx-act-s">Use your points for rewards</span>
        </button>
        <button className="rx-act">
          <span className="rx-act-ic">{IC.clock}</span>
          <span className="rx-act-t">History</span>
          <span className="rx-act-s">View activity &amp; transactions</span>
        </button>
      </div>

      {/* ---- Featured rewards ---- */}
      <div className="rx-sec-head">
        <span className="rx-sec-title">{IC.sparkle}<span>Featured Rewards</span></span>
        <button className="rx-viewall">View All {IC.chev}</button>
      </div>
      <div className="rx-grid">
        {FEATURED.map((r) => (
          <div key={r.id} className="rx-card">
            <span className="rx-card-ic">{IC[r.icon]}</span>
            <div className="rx-card-t">{r.title}</div>
            <div className="rx-card-s">{r.sub}</div>
            <div className="rx-card-p">{r.pts.toLocaleString()} PTS</div>
            <button className="rx-redeem">Redeem</button>
          </div>
        ))}
      </div>

      {/* ---- Recent activity ---- */}
      <div className="rx-sec-head">
        <span className="rx-sec-title">{IC.pulse}<span>Recent Activity</span></span>
        <button className="rx-viewall">View All {IC.chev}</button>
      </div>
      <ul className="rx-act-list">
        {ACTIVITY.map((a) => (
          <li key={a.id} className="rx-act-row">
            <span className={`rx-act-row-ic ${a.kind}`}>
              {a.kind === "scan" ? IC.scan : a.kind === "gift" ? IC.gift : IC.spark4}
            </span>
            <span className="rx-act-row-main">
              <span className="rx-act-row-t">{a.title}</span>
              <span className="rx-act-row-w">{a.when}</span>
            </span>
            <span className={`rx-delta ${a.delta < 0 ? "neg" : "pos"}`}>
              {a.delta < 0 ? "−" : "+"}{Math.abs(a.delta)} PTS
            </span>
            <button className="rx-kebab" aria-label="More">⋮</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- inline icons (stroked, inherit currentColor) ----
const IC: Record<string, React.ReactNode> = {
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <rect x="8" y="8" width="3" height="3" /><rect x="13" y="8" width="3" height="3" />
      <rect x="8" y="13" width="3" height="3" /><rect x="13" y="13" width="3" height="3" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" />
      <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
      <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4v3.5H7" /><path d="M12 8v4l3 2" />
    </svg>
  ),
  ticket: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" transform="translate(0 1) scale(1 0.9)" />
      <circle cx="9" cy="11" r="1.4" /><circle cx="15" cy="14" r="1.4" /><path d="M15.5 9.5l-7 6" />
    </svg>
  ),
  cup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1.2 12.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8z" />
      <path d="M5.5 8h13" /><path d="M13 3l-1.5 5M15 4l-1 4" />
    </svg>
  ),
  vip: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="8,3 16,3 21,8 21,16 16,21 8,21 3,16 3,8" />
      <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Rajdhani, sans-serif">VIP</text>
    </svg>
  ),
  sparkle: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>
  ),
  spark4: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z" /></svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
  ),
  chev: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
  ),
};

const css = `
  .rx{--o:#F5852A;--o2:#F0842E;--gold:#E7B93B;--cyan:#4EC3DE;--purple:#8F8AE8;
    max-width:480px;margin:0 auto;padding:14px 14px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .rx *{box-sizing:border-box}

  /* ----- hero ----- */
  .rx-hero{position:relative;padding:2px;margin-bottom:14px;
    background:linear-gradient(135deg,var(--o),rgba(245,133,42,.35));
    clip-path:polygon(0 22px,22px 0,calc(100% - 46px) 0,100% 46px,100% 100%,46px 100%,0 calc(100% - 22px));
    filter:drop-shadow(0 0 14px rgba(245,133,42,.28))}
  .rx-hero-inner{display:flex;align-items:center;gap:20px;padding:24px 26px;
    background:radial-gradient(120% 120% at 15% 0%,rgba(245,133,42,.12),rgba(10,7,3,.96) 60%),#080604;
    background-image:linear-gradient(rgba(245,133,42,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(245,133,42,.06) 1px,transparent 1px);
    background-size:auto,22px 22px,22px 22px;
    clip-path:polygon(0 21px,21px 0,calc(100% - 45px) 0,100% 45px,100% 100%,45px 100%,0 calc(100% - 21px))}
  .rx-star{flex:none;width:86px;height:86px;display:grid;place-items:center}
  .rx-star svg{width:100%;height:100%;overflow:visible}
  .rx-oct{fill:rgba(245,133,42,.06);stroke:var(--o);stroke-width:3}
  .rx-spark{fill:var(--o);filter:url(#illuminate-ui)}
  .rx-bal{display:flex;align-items:baseline;gap:8px;line-height:.9}
  .rx-bal-num{font-family:'Chakra Petch','Saira',sans-serif;font-size:52px;font-weight:700;color:#fff;letter-spacing:1px}
  .rx-bal-pts{font-size:22px;font-weight:700;color:var(--o)}
  .rx-bal-lbl{margin-top:8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#9a9a9a}

  /* ----- tier ----- */
  .rx-tier{border:1px solid #2e2e2e;border-radius:12px;padding:16px 18px;margin-bottom:14px;background:#0b0b0b}
  .rx-tier-top{display:flex;align-items:center;gap:13px}
  .rx-hex{flex:none;width:46px;height:46px}
  .rx-hex svg{width:100%;height:100%}
  .rx-hex-shape{fill:rgba(231,185,59,.08);stroke:var(--gold);stroke-width:4}
  .rx-hex-star{fill:var(--gold)}
  .rx-tier-name{flex:1;min-width:0}
  .rx-tier-h{font-size:19px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
  .rx-tier-sub{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8C8C8C;margin-top:1px}
  .rx-tier-next{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#9a9a9a;text-align:right}
  .rx-tier-next b{color:var(--o);font-weight:700}
  .rx-bar{height:9px;border-radius:99px;background:#242424;margin:14px 0 7px;overflow:hidden}
  .rx-bar>span{display:block;height:100%;border-radius:99px;
    background:linear-gradient(90deg,#c96a17,var(--o));box-shadow:0 0 10px rgba(245,133,42,.6)}
  .rx-bar-legend{display:flex;justify-content:space-between;font-size:12px;font-weight:600;letter-spacing:1px}
  .rx-bar-legend .lit{color:var(--o)}
  .rx-bar-legend .dim{color:#8C8C8C}

  /* ----- quick actions ----- */
  .rx-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:22px}
  .rx-act{display:flex;flex-direction:column;gap:6px;padding:13px;border:1px solid #2e2e2e;border-radius:12px;
    background:#0b0b0b;text-align:left;cursor:pointer;color:inherit;font-family:inherit;transition:border-color .18s}
  .rx-act:hover{border-color:var(--o)}
  .rx-act-ic{width:26px;height:26px;color:var(--o)}
  .rx-act-ic svg{width:100%;height:100%}
  .rx-act-t{font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
  .rx-act-s{font-size:11px;color:#8C8C8C;line-height:1.3}

  /* ----- section head ----- */
  .rx-sec-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 12px}
  .rx-sec-title{display:flex;align-items:center;gap:9px;font-size:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  .rx-sec-title svg{width:18px;height:18px;color:var(--o)}
  .rx-viewall{display:flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;
    color:var(--o);font-family:inherit;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  .rx-viewall svg{width:15px;height:15px}

  /* ----- featured grid ----- */
  .rx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-bottom:24px}
  .rx-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;padding:16px 10px 12px;
    border:1px solid rgba(245,133,42,.55);border-radius:12px;background:radial-gradient(120% 90% at 50% 0%,rgba(245,133,42,.12),#0a0a0a 70%);
    box-shadow:0 0 16px rgba(245,133,42,.12)}
  .rx-card-ic{width:44px;height:44px;color:var(--o);filter:url(#illuminate-ui);margin-bottom:2px}
  .rx-card-ic svg{width:100%;height:100%}
  .rx-card-t{font-size:16px;font-weight:700;letter-spacing:.5px}
  .rx-card-s{font-size:9.5px;letter-spacing:1px;text-transform:uppercase;color:#8C8C8C;min-height:24px}
  .rx-card-p{font-size:14px;font-weight:700;color:var(--o);margin:2px 0 8px}
  .rx-redeem{width:100%;height:34px;border:1px solid var(--o);border-radius:7px;background:transparent;
    color:var(--o);font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;
    font-size:13px;cursor:pointer;transition:background .16s,color .16s}
  .rx-redeem:hover{background:var(--o);color:#1a1103}

  /* ----- activity ----- */
  .rx-act-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
  .rx-act-row{display:flex;align-items:center;gap:12px;padding:13px 14px;border:1px solid #242424;border-radius:11px;background:#0b0b0b}
  .rx-act-row-ic{flex:none;width:26px;height:26px}
  .rx-act-row-ic svg{width:100%;height:100%}
  .rx-act-row-ic.scan{color:var(--cyan)}
  .rx-act-row-ic.gift{color:var(--purple)}
  .rx-act-row-ic.bonus{color:var(--cyan)}
  .rx-act-row-main{flex:1;min-width:0}
  .rx-act-row-t{display:block;font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase}
  .rx-act-row-w{display:block;font-size:11px;color:#8C8C8C;letter-spacing:.5px;margin-top:2px}
  .rx-delta{font-size:14px;font-weight:700;letter-spacing:.5px;white-space:nowrap}
  .rx-delta.pos{color:var(--o)}
  .rx-delta.neg{color:#ff6a4d}
  .rx-kebab{background:none;border:none;color:#7C7C7C;font-size:18px;cursor:pointer;padding:0 2px;line-height:1}
  .rx-kebab:hover{color:#fff}

  /* ----- responsive ----- */
  @media (max-width:420px){
    .rx-bal-num{font-size:44px}
    .rx-act{padding:11px}
    .rx-act-s{font-size:10px}
    .rx-card-s{font-size:9px}
  }
`;
