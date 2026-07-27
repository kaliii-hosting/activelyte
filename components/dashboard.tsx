"use client";

import React, { useEffect, useRef, useState } from "react";
import { SEARCH_EVENT } from "@/components/top-header";

// Cloned 1:1 from the supplied dashboard design file — this section is the
// source design system. The original CSS is verbatim; the "interaction
// layer" block at the end only adds hover/menu/search affordances using the
// existing design tokens.
const dashboardCss = `
  :root{
    --orange:#F5852A;
    --orange-txt:#F0842E;
    --purple:#8F8AE8;
    --cyan:#4EC3DE;
    --teal:#1F8A68;
    --yellow:#EBD82E;
    --white:#F2F2F2;
    --gray:#8C8C8C;
    --sub:#7C7C7C;
    --line:#4A4A4A;
    --divider:rgba(255,255,255,.07);
  }
  .dash-embed{width:100%;display:flex;justify-content:center;align-items:flex-start;padding:0}
  .dash-embed *{margin:0;padding:0;box-sizing:border-box}
  #wrap{width:100%;display:flex;justify-content:center}

  .stage{
    position:relative;
    width:1180px;height:813px;flex:none;
    transform-origin:top center;
    background:#000;
    font-family:'Saira',sans-serif;
  }

  /* frame linework (clock/search/new moved to the global top header) */
  .frame{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5}

  /* ---- FILES TAB ---- */
  .filestab{position:absolute;right:0;top:0;width:210px;height:72px;background:var(--orange);
    display:flex;align-items:center;justify-content:center;gap:12px;z-index:4;
    clip-path:polygon(34px 0,100% 0,100% 100%,0 100%)}
  .filestab .f{color:#2a1c07;font-size:19px;font-weight:600;letter-spacing:3px}
  .filestab .n{color:#150e03;font-size:24px;font-weight:700}

  /* ---- LIST ---- */
  .list{position:absolute;left:1px;right:1px;top:0;bottom:1px;display:flex;flex-direction:column;z-index:1}
  .row{height:74px;display:flex;align-items:center;padding:0 26px;border-bottom:1px solid var(--divider);position:relative}
  .row .bullet-slot{width:20px;flex:none;display:flex;align-items:center}
  .row .bullet{width:9px;height:9px;background:var(--orange)}
  .row .icon{width:52px;flex:none;display:flex;justify-content:center}
  .row .icon svg{width:42px;height:42px}
  .row .body{flex:1;min-width:0;padding-right:20px}
  .row .title{color:var(--white);font-size:26px;font-weight:600;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .row .sub{margin-top:1px;font-size:15px;font-weight:500;letter-spacing:1px;color:var(--sub);text-transform:uppercase}
  .row .sub b{color:#d4d4d4;font-weight:600}
  .row .sub .sl{color:var(--sub);padding:0 4px}

  .right{display:flex;align-items:center;flex:none}
  .right .dot{width:16px;display:flex;justify-content:center;flex:none}
  .sq{width:12px;height:12px;background:var(--orange)}
  .ring{width:16px;height:16px;border-radius:50%;border:2px solid var(--teal);box-sizing:border-box}
  .fill{width:16px;height:16px;border-radius:50%;background:var(--teal)}
  .cy{width:11px;height:11px;border-radius:50%;background:var(--cyan)}
  .shared{width:150px;padding-left:18px;font-size:18px;font-weight:500;letter-spacing:3px;color:var(--gray)}
  .shared.on{color:var(--orange-txt)}
  .kebab{width:30px;flex:none;display:flex;justify-content:center}
  .kebab svg{width:22px;height:22px}

  /* row1 special (no kebab, clears tab) */
  .row.head .right{margin-right:196px}
  .row.head .shared{width:auto;padding-left:16px}
  .avatar{width:38px;height:38px;border-radius:50%;overflow:hidden;border:1.5px solid #666;flex:none}
  .avatar svg{width:100%;height:100%;display:block}

  /* highlighted row */
  .row.active{border:2px solid var(--orange);border-radius:5px;
    background:linear-gradient(90deg,rgba(90,46,8,.85),rgba(24,14,5,.55));}
  .row.active .title{color:#fff}

  /* ---- interaction layer (added — reuses the tokens above) ---- */
  .row{cursor:pointer;transition:background .18s ease}
  .row:not(.active):hover{background:rgba(255,255,255,.045)}
  .kebab{cursor:pointer}
  .kebab:hover svg circle{fill:#fff}
  .rowmenu{
    position:absolute;right:22px;top:58px;z-index:8;min-width:180px;
    background:#0d0d0d;border:1px solid var(--line);padding:6px 0;
  }
  .rowmenu button{
    display:block;width:100%;text-align:left;background:none;border:none;
    color:var(--white);font-family:'Saira',sans-serif;font-size:15px;
    font-weight:500;letter-spacing:2px;padding:9px 18px;cursor:pointer;
  }
  .rowmenu button:hover{background:rgba(245,133,42,.15);color:var(--orange-txt)}

  /* ============================================================
     MOBILE REFLOW (≤640px). The desktop artboard above is a fixed
     1180×996 canvas; scaled onto a phone it becomes a tiny, dense
     thumbnail. Below this breakpoint we drop the absolute artboard
     positioning and let the same elements flow as a readable,
     full-width, tappable list. Desktop/tablet are unaffected.
     ============================================================ */
  @media (max-width:640px){
    .dash-embed{padding:0}
    #wrap{height:auto!important}
    .stage{
      width:100%!important;height:auto!important;transform:none!important;
      display:flex;flex-direction:column;
      border:1.5px solid var(--line); /* container border survives the reflow */
    }
    .frame{display:none}

    .filestab{
      position:static;width:auto;height:auto;align-self:flex-start;
      clip-path:none;border-radius:4px;padding:5px 16px;margin:6px 6px 2px;gap:8px;
    }
    .filestab .f{font-size:15px;letter-spacing:2px}
    .filestab .n{font-size:18px}

    .list{position:static;inset:auto}
    .row{height:auto;min-height:60px;padding:12px 8px;align-items:center}
    .row .icon{width:40px}
    .row .icon svg{width:30px;height:30px}
    .row .title{font-size:16px;letter-spacing:.5px;white-space:normal}
    .row .sub{font-size:11px;letter-spacing:.5px;white-space:normal}
    .row.head .right{margin-right:0}
    .right .dot{width:14px}
    .shared{width:auto;padding-left:10px;font-size:11px;letter-spacing:1.5px}
    .avatar{width:32px;height:32px}
    .kebab{width:26px}
    .rowmenu{right:8px;top:auto;bottom:8px}
  }
`;

// ---- SVG pieces from the design file, verbatim ----

const IconUsers = (
  <svg viewBox="0 0 28 24" fill="#eaeaea">
    <circle cx="9" cy="7.2" r="3" />
    <circle cx="18.6" cy="8" r="2.4" />
    <path d="M2.8 20c0-3.7 2.8-6 6.2-6s6.2 2.3 6.2 6z" />
    <path d="M15.4 20c.1-3 1.9-4.8 4.2-4.8 2 0 3.5 1.5 3.9 4z" />
  </svg>
);

const IconVideo = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#8F8AE8" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="7" width="12.5" height="10" rx="2.5" />
    <path d="M15.5 10.5 L21 7.5 V16.5 L15.5 13.5 Z" />
  </svg>
);

const IconSpark = (
  <svg viewBox="0 0 24 24" fill="#4EC3DE">
    <path d="M12 2c.6 5 2.9 7.4 8 8-5.1.6-7.4 3-8 8-.6-5-2.9-7.4-8-8 5.1-.6 7.4-3 8-8Z" />
  </svg>
);

const IconDoc = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#8F8AE8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <line x1="8" y1="9.5" x2="16" y2="9.5" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="16.5" x2="12.5" y2="16.5" />
  </svg>
);

const IconFlow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#F5852A" strokeWidth="2" strokeLinejoin="round">
    <rect x="3.5" y="3.5" width="5" height="5" />
    <rect x="15.5" y="6.5" width="5" height="5" />
    <rect x="9" y="15" width="5" height="5" />
    <path d="M6 8.5 V11 H18 V11.5" />
    <path d="M11.5 11.5 V15" />
  </svg>
);

const IconGuide = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#eaeaea" strokeWidth="2" strokeLinecap="round">
    <path d="M8 4 H4.5 V7.5" />
    <path d="M16 4 H19.5 V7.5" />
    <path d="M8 20 H4.5 V16.5" />
    <path d="M16 20 H19.5 V16.5" />
    <text
      x="12"
      y="16"
      textAnchor="middle"
      fontFamily="Saira"
      fontSize="12"
      fontWeight="700"
      fill="#eaeaea"
      stroke="none"
    >
      ?
    </text>
  </svg>
);

const IconImage = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#EBD82E" strokeWidth="2" strokeLinejoin="round">
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M5.5 16.5 L10 10.5 L13 14 L16 9.5 L18.5 14.5" />
  </svg>
);

const IconFolder = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#4EC3DE" strokeWidth="2" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const Avatar = (
  <svg viewBox="0 0 40 40">
    <defs>
      <clipPath id="av">
        <circle cx="20" cy="20" r="20" />
      </clipPath>
    </defs>
    <g clipPath="url(#av)">
      <rect width="40" height="40" fill="#7d6a58" />
      <ellipse cx="20" cy="40" rx="16" ry="15" fill="#2c2c30" />
      <circle cx="20" cy="15" r="8.5" fill="#e6c3a0" />
      <path d="M11 13a9 9 0 0 1 18 0c0-6-4-9-9-9s-9 3-9 9z" fill="#3a2c22" />
    </g>
  </svg>
);

const KebabSvg = (
  <svg viewBox="0 0 24 24" fill="#9a9a9a">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
);

// ---- row data (content exactly as in the design file) ----

interface RowData {
  id: number;
  title: string;
  icon: React.ReactNode;
  head?: boolean;
  sub?: React.ReactNode;
  dot?: "sq" | "ring" | "fill" | "cy";
  sharedOn: boolean;
}

const ROWS: RowData[] = [
  { id: 2, title: "SCREEN RECORDING 2026-02-27", icon: IconVideo, dot: "sq", sharedOn: true },
  { id: 3, title: "CYBERSEPIA BRAINSTORM", icon: IconSpark, dot: "ring", sharedOn: false },
  { id: 4, title: "WHAT IT MEANS TO GET IT RIGHT", icon: IconDoc, dot: "sq", sharedOn: true },
  { id: 5, title: "ASYNC AI C", icon: IconFlow, dot: "cy", sharedOn: false },
  { id: 6, title: "TESTING, ASSISTANT INTRO", icon: IconSpark, dot: "fill", sharedOn: false },
  { id: 7, title: "ICONS.AI", icon: IconGuide, dot: "sq", sharedOn: true },
  { id: 8, title: "GPTC VS APP PLATFORM", icon: IconFlow, dot: "cy", sharedOn: false },
  { id: 9, title: "SCREENSHOT_02062026", icon: IconImage, dot: "ring", sharedOn: false },
  { id: 10, title: "SOME THING FINAL", icon: IconDoc, dot: "sq", sharedOn: true },
  { id: 11, title: "NEW TEMPLATE PACK", icon: IconFolder, dot: "cy", sharedOn: false },
];

const MENU_ACTIONS = ["OPEN", "SHARE", "RENAME", "DELETE"];

export const Dashboard: React.FC = () => {
  // Design-file defaults render first (SSR-safe), then interactivity kicks in.
  const [activeId, setActiveId] = useState(2); // row 2 is highlighted in the design
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // Live filtering driven by the global top header's search input.
  useEffect(() => {
    const onSearch = (e: Event) => setQuery((e as CustomEvent<string>).detail ?? "");
    window.addEventListener(SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(SEARCH_EVENT, onSearch);
  }, []);

  // Any click outside a kebab menu closes it.
  useEffect(() => {
    if (menuFor === null) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  // Responsive fit for the fixed 1180×996 artboard:
  //  - phones (≤640px): clear the transform so the CSS reflow below takes over.
  //  - tablet/desktop: scale to fit width but never past native size (cap at 1),
  //    so it stops ballooning on wide screens and across browser zoom levels.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    function fit() {
      const s = document.getElementById("stage");
      const wrap = document.getElementById("wrap");
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
      wrap.style.height = 813 * scale + "px";
    }
    window.addEventListener("resize", fit);
    mq.addEventListener("change", fit);
    fit();
    return () => {
      window.removeEventListener("resize", fit);
      mq.removeEventListener("change", fit);
    };
  }, []);

  const trimmed = query.trim().toUpperCase();
  const visible = trimmed ? ROWS.filter((r) => r.title.toUpperCase().includes(trimmed)) : ROWS;

  return (
    <div className="dash-embed">
      <style>{dashboardCss}</style>
      <div id="wrap">
        <div className="stage" id="stage">
          {/* FRAME — side rails only; top edge comes from the global header,
              and the bottom divider line is intentionally omitted */}
          <svg className="frame" viewBox="0 0 1180 813" fill="none" preserveAspectRatio="none">
            <path d="M1 0 L1 812 M1179 0 L1179 812" stroke="#4A4A4A" strokeWidth="1.5" />
          </svg>

          {/* LIST */}
          <div className="list">
            {visible.map((row, i) => (
              <div
                key={row.id}
                className={`row${row.head ? " head" : ""}${activeId === row.id ? " active" : ""}`}
                style={i === visible.length - 1 ? { borderBottom: "none" } : undefined}
                onClick={() => setActiveId(row.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveId(row.id);
                }}
              >
                <span className="bullet-slot">{row.head && <span className="bullet"></span>}</span>
                <span className="icon">{row.icon}</span>
                <span className="body">
                  <div className="title">{row.title}</div>
                  {row.sub && <div className="sub">{row.sub}</div>}
                </span>
                <span className="right">
                  {row.head ? (
                    <>
                      <span className="avatar">{Avatar}</span>
                      <span className={`shared${row.sharedOn ? " on" : ""}`}>SHARED</span>
                    </>
                  ) : (
                    <>
                      <span className="dot">{row.dot && <span className={row.dot}></span>}</span>
                      <span className={`shared${row.sharedOn ? " on" : ""}`}>SHARED</span>
                      <span
                        className="kebab"
                        role="button"
                        aria-label={`Options for ${row.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === row.id ? null : row.id);
                        }}
                      >
                        {KebabSvg}
                      </span>
                    </>
                  )}
                </span>

                {menuFor === row.id && (
                  <div className="rowmenu" onClick={(e) => e.stopPropagation()}>
                    {MENU_ACTIONS.map((action) => (
                      <button key={action} onClick={() => setMenuFor(null)}>
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
