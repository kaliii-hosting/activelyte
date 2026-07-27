"use client";

import React, { useEffect } from "react";

// Rewards / Profile artboard. Built on the same fixed-canvas + responsive-scale
// pattern as the dashboard, and reusing the same colour tokens. Per the design
// spec the type is Space Grotesk (headings / UI) and Inter (body / secondary).
// This is a self-contained demo — all figures are static sample data.
const css = `
  :root{
    --orange:#F5852A;
    --orange-txt:#F0842E;
    --purple:#8F8AE8;
    --cyan:#4EC3DE;
    --teal:#1F8A68;
    --white:#F2F2F2;
    --gray:#8C8C8C;
    --sub:#7C7C7C;
    --line:#4A4A4A;
    --card:#0B0B0B;
    --card-line:rgba(255,255,255,.09);
    --divider:rgba(255,255,255,.07);
  }
  .pf-embed{width:100%;display:flex;justify-content:center;align-items:flex-start;padding:0}
  .pf-embed *{margin:0;padding:0;box-sizing:border-box}
  #pf-wrap{width:100%;display:flex;justify-content:center}

  .pf-stage{
    position:relative;width:1180px;flex:none;
    transform-origin:top center;background:#000;
    border:1.5px solid var(--line);border-top:none;border-bottom:none; /* top edge comes from the global header */
    font-family:'Inter',sans-serif;
  }
  .pf-h{font-family:'Space Grotesk',sans-serif}

  /* ---- SUBHEAD BAR ---- */
  .pf-sub{position:relative;height:74px;display:flex;align-items:center;z-index:3;border-bottom:1.5px solid #3E3E3E}
  .pf-back{width:64px;display:flex;justify-content:center;align-items:center;cursor:pointer}
  .pf-back svg{width:30px;height:30px}
  .pf-subdiv{width:1px;height:40px;background:var(--line)}
  .pf-crumb{display:flex;align-items:center;gap:16px;padding-left:22px}
  .pf-crumb .gift{width:34px;height:34px}
  .pf-crumb .txt{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:600;letter-spacing:4px;color:var(--white)}
  .pf-crumb .txt .slash{color:var(--gray);padding:0 4px}
  .pf-shared{margin-left:auto;display:flex;align-items:center;gap:14px;padding-right:28px}
  .pf-shared .av{width:38px;height:38px;border-radius:50%;overflow:hidden;border:1.5px solid #666}
  .pf-shared .lb{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:500;letter-spacing:3px;color:var(--orange-txt)}
  .pf-points{height:74px;min-width:220px;background:var(--orange);display:flex;align-items:center;justify-content:center;gap:18px;
    clip-path:polygon(34px 0,100% 0,100% 100%,0 100%);padding:0 40px 0 46px}
  .pf-points .k{font-family:'Space Grotesk',sans-serif;color:#2a1c07;font-size:19px;font-weight:600;letter-spacing:3px}
  .pf-points .v{font-family:'Space Grotesk',sans-serif;color:#150e03;font-size:30px;font-weight:700}

  /* ---- MAIN CONTENT ---- */
  .pf-main{position:relative;padding:34px 34px 72px}

  /* IDENTITY + TOTAL POINTS split row */
  .pf-top{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;padding-bottom:30px}
  .pf-idcol{display:flex;align-items:center;gap:26px;padding-right:34px}
  .pf-vdiv{background:var(--divider)}
  .pf-ptcol{padding-left:44px;display:flex;flex-direction:column;justify-content:center}
  .pf-bigav{width:150px;height:150px;border-radius:50%;overflow:hidden;border:2px solid var(--orange);flex:none}
  .pf-idmeta .name{font-family:'Space Grotesk',sans-serif;font-size:52px;font-weight:700;letter-spacing:2px;color:#fff;line-height:1}
  .pf-idmeta .handle{font-size:22px;font-weight:400;color:var(--cyan);margin-top:6px}
  .pf-idmeta .since{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:500;letter-spacing:2px;color:var(--sub);margin-top:14px;text-transform:uppercase}
  .pf-idmeta .since b{color:#d4d4d4;font-weight:600;padding-left:4px}
  .pf-badge{margin-top:16px;display:inline-flex;align-items:center;gap:10px;border:1.5px solid var(--orange);border-radius:6px;padding:9px 16px;cursor:pointer;transition:background .18s ease}
  .pf-badge:hover{background:rgba(245,133,42,.12)}
  .pf-badge svg{width:20px;height:20px}
  .pf-badge span{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:600;letter-spacing:2px;color:var(--orange-txt)}

  .pf-pthead{display:flex;justify-content:space-between;align-items:flex-start}
  .pf-pthead .lbl{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:500;letter-spacing:3px;color:var(--sub)}
  .pf-hex{width:96px;height:108px;position:relative;flex:none;margin-top:-6px}
  .pf-hex .num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;font-size:38px;font-weight:700;color:var(--purple)}
  .pf-bignum{font-family:'Space Grotesk',sans-serif;font-size:74px;font-weight:700;color:var(--orange-txt);line-height:.9;margin-top:4px}
  .pf-lvlrow{display:flex;justify-content:space-between;align-items:baseline;margin-top:18px}
  .pf-lvlrow .lv{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:600;letter-spacing:2px;color:var(--white)}
  .pf-lvlrow .frac{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:500;color:var(--gray)}
  .pf-lvlrow .frac b{color:var(--orange-txt);font-weight:700}
  .pf-track{height:10px;background:#1c1c1c;border-radius:6px;margin-top:10px;overflow:hidden}
  .pf-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#F5852A,#F7A44E)}

  /* CARDS ROW */
  .pf-cards{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:6px}
  .pf-card{border:1px solid var(--card-line);border-radius:10px;background:var(--card);padding:24px 26px 20px;
    clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%)}
  .pf-card .ch{display:flex;align-items:center;gap:12px;margin-bottom:20px}
  .pf-card .ch svg{width:26px;height:26px}
  .pf-card .ch .t{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:600;letter-spacing:3px;color:var(--white)}

  /* progress rows */
  .pf-prog{display:flex;flex-direction:column;gap:20px}
  .pf-prow .head{display:flex;align-items:center;gap:12px}
  .pf-prow .ico{width:26px;height:26px;flex:none;display:flex;align-items:center;justify-content:center}
  .pf-prow .lbl{flex:1;font-family:'Space Grotesk',sans-serif;font-size:17px;font-weight:600;letter-spacing:2px;color:var(--white);text-transform:uppercase}
  .pf-prow .frac{font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:600}
  .pf-prow .frac .tot{color:var(--gray);font-weight:500}
  .pf-prow .track{height:9px;background:#1c1c1c;border-radius:6px;margin-top:9px;margin-left:38px;overflow:hidden}
  .pf-prow .bar{height:100%;border-radius:6px}

  .pf-cardlink{margin-top:22px;padding-top:16px;border-top:1px solid var(--divider);display:flex;align-items:center;justify-content:space-between;cursor:pointer}
  .pf-cardlink span{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:600;letter-spacing:2px;color:var(--orange-txt)}
  .pf-cardlink svg{width:18px;height:18px;stroke:var(--orange-txt)}
  .pf-cardlink:hover span{color:#ffa659}

  /* next reward inner */
  .pf-next{border:1px solid var(--card-line);border-radius:8px;background:rgba(255,255,255,.02);padding:26px 26px;display:flex;align-items:center;gap:26px}
  .pf-nexthex{width:120px;height:132px;position:relative;flex:none}
  .pf-nexthex .star{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .pf-nexthex .star svg{width:52px;height:52px}
  .pf-nextmeta .t{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;letter-spacing:2px;color:#fff}
  .pf-nextmeta .s{font-size:17px;font-weight:400;color:var(--gray);margin-top:6px;letter-spacing:1px}
  .pf-nextmeta .p{font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:600;letter-spacing:1px;color:var(--orange-txt);margin-top:14px}

  /* RECENT REWARDS TABLE */
  .pf-recent{border:1px solid var(--card-line);border-radius:10px;background:var(--card);margin-top:26px;padding:8px 26px 6px}
  .pf-recent .rh{font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:600;letter-spacing:3px;color:var(--white);padding:20px 0 14px}
  .pf-rrow{display:flex;align-items:center;height:60px;border-top:1px solid var(--divider);cursor:pointer;transition:background .16s ease}
  .pf-rrow:hover{background:rgba(255,255,255,.03)}
  .pf-rrow .ico{width:52px;flex:none;display:flex;align-items:center}
  .pf-rrow .ico svg{width:30px;height:30px}
  .pf-rrow .nm{flex:1;font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:600;letter-spacing:1.5px;color:var(--white);text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pf-rrow .dt{width:180px;font-size:17px;font-weight:400;color:var(--sub);text-align:left}
  .pf-rrow .pts{width:120px;font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:600;color:var(--orange-txt);text-align:right;padding-right:40px}
  .pf-rrow .st{width:150px;display:flex;align-items:center;gap:10px}
  .pf-rrow .st .dot{width:11px;height:11px;border-radius:50%;background:var(--cyan)}
  .pf-rrow .st .lb{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:500;letter-spacing:2px;color:var(--gray)}
  .pf-histlink{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--divider);padding:18px 0;cursor:pointer}
  .pf-histlink span{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:600;letter-spacing:2px;color:var(--orange-txt)}
  .pf-histlink svg{width:18px;height:18px;stroke:var(--orange-txt)}
  .pf-histlink:hover span{color:#ffa659}

  /* ---- MOBILE REFLOW ---- */
  @media (max-width:680px){
    .pf-embed{padding:0}
    #pf-wrap{height:auto!important}
    /* container border survives the mobile reflow */
    .pf-stage{width:100%!important;height:auto!important;transform:none!important;display:flex;flex-direction:column}
    .pf-sub{position:static;height:auto;flex-wrap:wrap;padding:8px 6px;gap:10px}
    .pf-crumb .txt{font-size:19px;letter-spacing:2px}
    .pf-shared{padding-right:8px}
    .pf-points{width:100%;flex:1 0 100%;order:5;clip-path:none;border-radius:6px;height:56px;margin-top:6px}
    .pf-main{position:static;padding:14px 6px 20px}
    .pf-top{grid-template-columns:1fr;gap:22px}
    .pf-vdiv{display:none}
    .pf-idcol{flex-direction:column;text-align:center;padding-right:0}
    .pf-ptcol{padding-left:0}
    .pf-idmeta .name{font-size:40px}
    .pf-bignum{font-size:56px}
    .pf-cards{grid-template-columns:1fr}
    .pf-next{flex-direction:column;text-align:center}
    .pf-rrow{height:auto;padding:12px 0;flex-wrap:wrap;gap:6px}
    .pf-rrow .dt{width:auto;font-size:14px;order:5;padding-left:52px}
    .pf-rrow .pts{width:auto;padding-right:16px}
    .pf-rrow .st{width:auto}
    .pf-rrow .nm{font-size:16px;flex:1 1 auto}
  }
`;

/* ---------- SVG pieces ---------- */

const BigAvatar = (
  <svg viewBox="0 0 150 150">
    <defs>
      <clipPath id="pfav">
        <circle cx="75" cy="75" r="75" />
      </clipPath>
    </defs>
    <g clipPath="url(#pfav)">
      <rect width="150" height="150" fill="#6f5c4a" />
      <ellipse cx="75" cy="150" rx="58" ry="54" fill="#2c2c30" />
      <circle cx="75" cy="58" r="32" fill="#e6c3a0" />
      <path d="M41 52a34 34 0 0 1 68 0c0-22-15-34-34-34s-34 12-34 34z" fill="#3a2c22" />
    </g>
  </svg>
);

const SmallAvatar = (
  <svg viewBox="0 0 40 40">
    <defs>
      <clipPath id="pfsav">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
    </defs>
    <g clipPath="url(#pfsav)">
      <rect width="40" height="40" fill="#7d6a58" />
      <ellipse cx="20" cy="40" rx="16" ry="15" fill="#2c2c30" />
      <circle cx="20" cy="15" r="8.5" fill="#e6c3a0" />
      <path d="M11 13a9 9 0 0 1 18 0c0-6-4-9-9-9s-9 3-9 9z" fill="#3a2c22" />
    </g>
  </svg>
);

const GiftIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#F5852A" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="10" rx="1" />
    <path d="M3 10h18M12 10v10" />
    <path d="M12 10s-1.5-6-4-6a2.2 2.2 0 0 0 0 4.4" />
    <path d="M12 10s1.5-6 4-6a2.2 2.2 0 0 1 0 4.4" />
  </svg>
);

const SyncIcon = (
  <svg viewBox="0 0 24 24" fill="#F5852A">
    <circle cx="6" cy="7" r="2.4" />
    <circle cx="18" cy="7" r="2.4" />
    <circle cx="12" cy="17" r="2.4" />
    <path d="M6 7l6 10M18 7l-6 10" stroke="#F5852A" strokeWidth="1.4" />
  </svg>
);

const Hexagon = ({ stroke }: { stroke: string }) => (
  <svg viewBox="0 0 96 108" fill="none">
    <path d="M48 3 L91 27 V81 L48 105 L5 81 V27 Z" stroke={stroke} strokeWidth="2.5" />
  </svg>
);

const StarHex = (
  <svg viewBox="0 0 120 132" fill="none">
    <path d="M60 4 L113 33 V99 L60 128 L7 99 V33 Z" stroke="#4EC3DE" strokeWidth="2.5" />
  </svg>
);

const StarIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#4EC3DE" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 3 L14.6 9.2 L21 9.7 L16 14 L17.6 20.3 L12 16.8 L6.4 20.3 L8 14 L3 9.7 L9.4 9.2 Z" />
  </svg>
);

const Chevron = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5 L16 12 L9 19" />
  </svg>
);

// recent-reward row icons
const RSpark = (
  <svg viewBox="0 0 24 24" fill="#4EC3DE">
    <path d="M12 2c.6 5 2.9 7.4 8 8-5.1.6-7.4 3-8 8-.6-5-2.9-7.4-8-8 5.1-.6 7.4-3 8-8Z" />
  </svg>
);
const RStorage = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#F5852A" strokeWidth="2" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" fill="#F5852A" stroke="none" />
  </svg>
);
const RPack = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#8F8AE8" strokeWidth="2" strokeLinejoin="round">
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
    <path d="M12 7.5 L13.4 10.8 L17 11 L14.2 13.2 L15 16.6 L12 14.7 L9 16.6 L9.8 13.2 L7 11 L10.6 10.8 Z" fill="#8F8AE8" stroke="none" />
  </svg>
);
const RRing = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#1F8A68" strokeWidth="2.4">
    <circle cx="12" cy="12" r="8" />
  </svg>
);
const RGift = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#F5852A" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="10" rx="1" />
    <path d="M3 10h18M12 10v10" />
    <path d="M12 10s-1.5-6-4-6a2.2 2.2 0 0 0 0 4.4" />
    <path d="M12 10s1.5-6 4-6a2.2 2.2 0 0 1 0 4.4" />
  </svg>
);

/* ---------- data ---------- */

const PROGRESS = [
  { key: "TASKS COMPLETED", value: 32, total: 50, color: "#4EC3DE", icon: StarIcon },
  {
    key: "FILES SHARED",
    value: 18,
    total: 30,
    color: "#F5852A",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#F5852A" strokeWidth="2" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" fill="#F5852A" stroke="none" />
      </svg>
    ),
  },
  {
    key: "DAYS ACTIVE",
    value: 12,
    total: 20,
    color: "#8F8AE8",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#8F8AE8" strokeWidth="2" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="M12 7.5 L13.2 10.6 L16.5 10.8 L14 12.9 L14.8 16.2 L12 14.4 L9.2 16.2 L10 12.9 L7.5 10.8 L10.8 10.6 Z" fill="#8F8AE8" stroke="none" />
      </svg>
    ),
  },
];

interface RewardRow {
  id: number;
  name: string;
  date: string;
  points: number;
  icon: React.ReactNode;
}

const RECENT: RewardRow[] = [
  { id: 1, name: "EARLY ACCESS PASS", date: "2026-02-24", points: 500, icon: RSpark },
  { id: 2, name: "10GB STORAGE UPGRADE", date: "2026-02-18", points: 300, icon: RStorage },
  { id: 3, name: "EXCLUSIVE TEMPLATE PACK", date: "2026-02-10", points: 250, icon: RPack },
  { id: 4, name: "COMMUNITY SHOUTOUT", date: "2026-02-05", points: 150, icon: RRing },
  { id: 5, name: "WELCOME BONUS", date: "2026-02-01", points: 1000, icon: RGift },
];

const LEVEL_CURRENT = 2450;
const LEVEL_TARGET = 3000;

export const ProfileDemo: React.FC = () => {
  // Fit the fixed 1180-wide artboard: scale to width (never past native) on
  // tablet/desktop; clear the transform on phones so the CSS reflow takes over.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 680px)");
    function fit() {
      const s = document.getElementById("pf-stage");
      const wrap = document.getElementById("pf-wrap");
      if (!s || !wrap) return;
      if (mq.matches) {
        s.style.transform = "";
        wrap.style.height = "";
        return;
      }
      // fill the viewport width — the artboard scales up past its native
      // 1180px on large screens instead of capping at 1
      const scale = wrap.clientWidth / 1180;
      s.style.transform = "scale(" + scale + ")";
      // offsetHeight ignores the transform, so this tracks the natural height
      wrap.style.height = s.offsetHeight * scale + "px";
    }
    window.addEventListener("resize", fit);
    mq.addEventListener("change", fit);
    fit();
    return () => {
      window.removeEventListener("resize", fit);
      mq.removeEventListener("change", fit);
    };
  }, []);

  const levelPct = Math.round((LEVEL_CURRENT / LEVEL_TARGET) * 100);

  return (
    <div className="pf-embed">
      <style>{css}</style>
      <div id="pf-wrap">
        <div className="pf-stage" id="pf-stage">
          {/* SUBHEAD */}
          <div className="pf-sub">
            <div className="pf-back" role="button" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="#e8e8e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5 L8 12 L15 19" />
              </svg>
            </div>
            <div className="pf-subdiv" />
            <div className="pf-crumb">
              <span className="gift">{GiftIcon}</span>
              <span className="txt">
                REWARDS<span className="slash">/</span>PROFILE
              </span>
            </div>
            <div className="pf-shared">
              <span className="av">{SmallAvatar}</span>
              <span className="lb">SHARED</span>
            </div>
            <div className="pf-points">
              <span className="k">POINTS</span>
              <span className="v">2,450</span>
            </div>
          </div>

          {/* MAIN */}
          <div className="pf-main">
            {/* identity + total points */}
            <div className="pf-top">
              <div className="pf-idcol">
                <span className="pf-bigav">{BigAvatar}</span>
                <div className="pf-idmeta">
                  <div className="name pf-h">JACOB</div>
                  <div className="handle">@jacob_sync</div>
                  <div className="since">
                    MEMBER SINCE<b>MAR 12, 2025</b>
                  </div>
                  <div className="pf-badge" role="button">
                    {SyncIcon}
                    <span>SYNC MEMBER</span>
                  </div>
                </div>
              </div>

              <div className="pf-vdiv" />

              <div className="pf-ptcol">
                <div className="pf-pthead">
                  <div>
                    <div className="lbl">TOTAL POINTS</div>
                    <div className="pf-bignum">2,450</div>
                  </div>
                  <div className="pf-hex">
                    <Hexagon stroke="#8F8AE8" />
                    <span className="num">4</span>
                  </div>
                </div>
                <div className="pf-lvlrow">
                  <span className="lv">LEVEL 4</span>
                  <span className="frac">
                    <b>2,450</b> / 3,000
                  </span>
                </div>
                <div className="pf-track">
                  <div className="pf-fill" style={{ width: `${levelPct}%` }} />
                </div>
              </div>
            </div>

            {/* cards */}
            <div className="pf-cards">
              {/* rewards progress */}
              <div className="pf-card">
                <div className="ch">
                  {StarIcon}
                  <span className="t">REWARDS PROGRESS</span>
                </div>
                <div className="pf-prog">
                  {PROGRESS.map((p) => (
                    <div className="pf-prow" key={p.key}>
                      <div className="head">
                        <span className="ico">{p.icon}</span>
                        <span className="lbl">{p.key}</span>
                        <span className="frac" style={{ color: p.color }}>
                          {p.value}
                          <span className="tot"> / {p.total}</span>
                        </span>
                      </div>
                      <div className="track">
                        <div
                          className="bar"
                          style={{ width: `${(p.value / p.total) * 100}%`, background: p.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pf-cardlink" role="button">
                  <span>VIEW PROGRESS DETAILS</span>
                  {Chevron}
                </div>
              </div>

              {/* next reward */}
              <div className="pf-card">
                <div className="ch">
                  {GiftIcon}
                  <span className="t">NEXT REWARD</span>
                </div>
                <div className="pf-next">
                  <div className="pf-nexthex">
                    {StarHex}
                    <span className="star">{StarIcon}</span>
                  </div>
                  <div className="pf-nextmeta">
                    <div className="t pf-h">SYNC PRO</div>
                    <div className="s">EXCLUSIVE BADGE</div>
                    <div className="p">3,000 POINTS</div>
                  </div>
                </div>
                <div className="pf-cardlink" role="button">
                  <span>VIEW ALL REWARDS</span>
                  {Chevron}
                </div>
              </div>
            </div>

            {/* recent rewards */}
            <div className="pf-recent">
              <div className="rh">RECENT REWARDS</div>
              {RECENT.map((r) => (
                <div className="pf-rrow" key={r.id} role="button" tabIndex={0}>
                  <span className="ico">{r.icon}</span>
                  <span className="nm">{r.name}</span>
                  <span className="dt">{r.date}</span>
                  <span className="pts">+{r.points.toLocaleString()}</span>
                  <span className="st">
                    <span className="dot" />
                    <span className="lb">CLAIMED</span>
                  </span>
                </div>
              ))}
              <div className="pf-histlink" role="button">
                <span>VIEW ALL HISTORY</span>
                {Chevron}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
