"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ScreenScanner } from "./screen-scanner";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdminRole } from "@/lib/types/roles";
import { scanCode } from "@/lib/services/reward-service";

// Cloned from the supplied "Octagon toolbar" design file. The octagon artwork
// (paths, coords, icons, text) is byte-identical to the source; added on top:
// fixed positioning, routing, and a REAL multi-scale bloom on the active item.
//
// The viewBox is reframed to the octagon's own bounds (the source had large
// demo whitespace above/below) so it seats as a compact bottom bar — no
// drawing coordinate is changed, only the camera window.

const ORANGE = "#F5852A"; // brand orange (matches the top bar); global illumination hue
const GRAY = "#909090";
const DIM = "#4a4a4a";

// Lucide-style stroked glyphs for the drop-up menu. `currentColor` lets each
// row inherit the item's gray → orange colour on hover / active.
const IconProfile = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="9.9" r="3.1" />
    <path d="M6.3 19.1a6.1 6.1 0 0 1 11.4 0" />
  </svg>
);
const IconBell = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const IconChat = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.4 4.2H3.6a1 1 0 0 0-1 1v9.3a1 1 0 0 0 1 1h3.2v4.1l4.3-4.1h9.3a1 1 0 0 0 1-1V5.2a1 1 0 0 0-1-1z" />
    <g fill="currentColor" stroke="none">
      <circle cx="8.8" cy="9.8" r="1.1" />
      <circle cx="12" cy="9.8" r="1.1" />
      <circle cx="15.2" cy="9.8" r="1.1" />
    </g>
  </svg>
);
const IconGear = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconShield = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const IconStore = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 9.5 5 4h14l1.5 5.5M4 9.5h16v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
    <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
  </svg>
);
const IconTag = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.6 13.4 12 22l-9-9V3h10z" />
    <circle cx="7.5" cy="7.5" r="1.4" />
  </svg>
);

type MenuEntry = { href: string; label: string; icon: React.ReactNode };

// Drop-up menu entries. New pages drop straight in here — they inherit the
// row styling automatically.
const IconInfo = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
  </svg>
);

const MENU: MenuEntry[] = [
  { href: "/profile", label: "Profile", icon: IconProfile },
  { href: "/messages", label: "Messages", icon: IconChat },
  { href: "/notifications", label: "Notifications", icon: IconBell },
  { href: "/about", label: "About", icon: IconInfo },
  { href: "/settings", label: "Settings", icon: IconGear },
];

// Extra entries shown only to admin-tier users.
const ADMIN_MENU: MenuEntry[] = [
  { href: "/admin/members", label: "Members", icon: IconShield },
  { href: "/admin/shops", label: "Shops", icon: IconStore },
  { href: "/admin/catalog", label: "Catalog", icon: IconTag },
];

const octagonCss = `
  .octo-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;pointer-events:none;
    padding-bottom:env(safe-area-inset-bottom)}
  .octo-nav *{box-sizing:border-box}
  .octo-inner{max-width:720px;margin:0 auto;padding:0 12px}
  /* bar shrinks as the viewport widens so it doesn't dominate on desktop */
  @media (min-width:640px){.octo-inner{max-width:560px}}
  @media (min-width:1024px){.octo-inner{max-width:460px}}
  @media (min-width:1440px){.octo-inner{max-width:400px}}
  .octo-nav svg{width:100%;height:auto;display:block;overflow:visible;pointer-events:none}
  .octo-nav text{font-family:'Rajdhani',sans-serif;font-weight:700;text-transform:uppercase;
    -webkit-user-select:none;user-select:none}
  .octo-nav .octo-bg{pointer-events:auto}
  .octo-nav .nav-item{pointer-events:auto;cursor:pointer;transition:filter .25s ease}
  .octo-nav .nav-item:not(.is-active):hover{filter:brightness(1.5)}

  /* full-screen catcher: taps outside close the drop-up, and it blurs the page
     behind it. The bar + menu screen paint above it (z-index -1) so they stay
     sharp; only the page is a faint, barely-legible blur. */
  .octo-scrim{
    position:fixed;inset:0;z-index:-1;pointer-events:auto;
    background:rgba(4,4,6,0.34);
    -webkit-backdrop-filter:blur(11px);backdrop-filter:blur(11px);
  }

  /* compact, centered drop-up — capped small so it never dominates the viewport
     on tablet/desktop, and centered on every screen size */
  .octo-menu-wrap{
    width:100%;max-width:min(370px,90vw);margin:0 auto;
    padding:0 12px;pointer-events:none;
  }
  @media (min-width:640px){.octo-menu-wrap{max-width:360px}}

  /* clip: collapses to nothing until opened, then reveals the screen sliding up.
     grid-rows 0fr->1fr animates real height with no image distortion. */
  .octo-menu-clip{
    display:grid;grid-template-rows:0fr;opacity:0;margin-bottom:10px;
    pointer-events:none;
    transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1),opacity .26s ease;
  }
  .octo-menu-clip.is-open{grid-template-rows:1fr;opacity:1;pointer-events:auto}
  .octo-menu-clip > .octo-menu-clipinner{overflow:hidden;min-height:0}

  /* the device screen (rendered in Blender) IS the panel — horizontal on every
     screen size (mobile, tablet, desktop). */
  .octo-menu-screen{
    position:relative;width:100%;aspect-ratio:1456 / 1305;   /* landscape */
    background:url('/screen-landscape.png?v=11') center / 100% 100% no-repeat;
    filter:drop-shadow(0 0 16px rgba(0,0,0,.5));
  }
  /* live UI fitted to the glass rect. Scrolls with mouse wheel, keyboard, and
     iOS touch momentum; a subtle grey/white scroll indicator appears when the
     items overflow the screen. */
  .octo-screen-ui{
    /* right edge extended to the glass border so the scrollbar hugs the
       screen's edge like a real device scroll indicator; the extra right
       padding keeps the menu rows in their original spot */
    position:absolute;left:7.28%;top:6.743%;width:89.9%;height:85.211%;
    display:flex;flex-direction:column;
    padding:2% 7.7% 2% 5%;border-radius:3% / 3%;
    overflow-y:auto;overflow-x:hidden;outline:none;
    -webkit-overflow-scrolling:touch;overscroll-behavior:contain;
    scrollbar-width:auto;scrollbar-color:rgba(228,228,228,.45) transparent;
  }
  .octo-screen-ui::-webkit-scrollbar{width:11px}
  .octo-screen-ui::-webkit-scrollbar-track{background:transparent;margin:10px 0}
  .octo-screen-ui::-webkit-scrollbar-thumb{
    background:rgba(228,228,228,.42);border-radius:99px;
    border:2.5px solid transparent;background-clip:padding-box;
  }
  .octo-screen-ui:hover::-webkit-scrollbar-thumb{background-color:rgba(240,240,240,.6)}

  /* grow to fill the screen when there are few items; hold min-height and let
     the screen scroll once there are many. */
  .octo-menu-item{
    flex:1 0 auto;min-height:3.1em;
    display:flex;align-items:center;gap:16px;
    padding:0 10px;border-bottom:1px solid rgba(255,255,255,.07);
    color:${GRAY};cursor:pointer;outline:none;
    font-family:'Rajdhani',sans-serif;font-weight:700;text-transform:uppercase;
    letter-spacing:3px;font-size:clamp(16px,4.2vw,24px);line-height:1;
    -webkit-user-select:none;user-select:none;
    transition:color .2s ease,filter .25s ease;
  }
  .octo-menu-item:last-child{border-bottom:none}
  .octo-menu-item svg{width:1.35em;height:1.35em;flex:none;display:block}
  /* hover, keyboard focus, and current-page all get the SAME bloom the bottom
     bar uses (global illumination — see global.md) */
  .octo-menu-item:hover,.octo-menu-item:focus,.octo-menu-item.is-active{
    color:${ORANGE};filter:url(#illuminate-ui);
  }
`;

export const OctagonToolbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, openAuth } = useAuth();
  // Admin-tier users get extra menu entries (e.g. Members management).
  const menu = isAdminRole(user?.role) ? [...MENU, ...ADMIN_MENU] : MENU;

  // A scanned code is handed to the reward engine; the returned string is shown
  // in the scanner's status readout.
  const handleScan = async (code: string): Promise<string> => {
    if (!user) {
      openAuth("login");
      return "Sign in to earn points";
    }
    try {
      const r = await scanCode(code);
      if (r.replay) return "Already scanned";
      return `+${r.pointsAwarded} points!`;
    } catch (e) {
      return e instanceof Error ? e.message : "Couldn't redeem that code";
    }
  };
  const innerRef = useRef<HTMLDivElement>(null);
  const screenUiRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // SCAN opens the same drop-up screen, but in QR-scanner mode (live camera).
  const [scanOpen, setScanOpen] = useState(false);
  const panelOpen = menuOpen || scanOpen;

  // Close the drop-up whenever the route changes (i.e. after a selection).
  useEffect(() => {
    setMenuOpen(false);
    setScanOpen(false);
  }, [pathname]);

  // Escape closes the scanner (the menu handles its own Escape via focus).
  useEffect(() => {
    if (!scanOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScanOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanOpen]);

  // When the menu opens, move focus into it so arrow keys work immediately.
  useEffect(() => {
    if (menuOpen) screenUiRef.current?.focus({ preventScroll: true });
  }, [menuOpen]);

  // Arrow-key / Home / End / Escape navigation over the menu items.
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const ui = screenUiRef.current;
    if (!ui) return;
    const items = Array.from(
      ui.querySelectorAll<HTMLElement>(".octo-menu-item"),
    );
    if (!items.length) return;
    const cur = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      (items[cur + 1] ?? items[0]).focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      (items[cur - 1] ?? items[items.length - 1]).focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMenuOpen(false);
    }
  };

  // Publish the rendered nav height so page content can reserve space for it.
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--bottom-nav-h",
        `${el.getBoundingClientRect().height}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  // While the drop-up panel is open, ONLY its own slot stays illuminated — the
  // other bar items drop their active glow so the open panel reads as the one
  // active control.
  const homeA = !panelOpen && isActive("/");
  const rewA = !panelOpen && isActive("/rewards");
  const shopA = !panelOpen && isActive("/shop");
  // SCAN doesn't navigate — it lights while its scanner panel is open.
  const scanA = scanOpen;
  // The MENU slot lights up while its drop-up is open, or you're on any of the
  // pages the menu leads to.
  const menuA = menuOpen || (!scanOpen && menu.some((m) => isActive(m.href)));

  // Navigating from any other bar slot also closes the drop-up panel (even when
  // the route doesn't change, e.g. tapping the slot you're already on).
  const go = (href: string) => () => {
    setMenuOpen(false);
    setScanOpen(false);
    router.push(href);
  };
  const bloom = (on: boolean) => (on ? { filter: "url(#illuminate)" } : undefined);
  const cls = (on: boolean) => `nav-item${on ? " is-active" : ""}`;

  return (
    <nav className="octo-nav" aria-label="Primary">
      <style>{octagonCss}</style>

      {/* tap-outside catcher, only while the drop-up is open */}
      {panelOpen && (
        <div
          className="octo-scrim"
          onClick={() => {
            setMenuOpen(false);
            setScanOpen(false);
          }}
        />
      )}

      {/* --- drop-up panel rendered inside the kiosk screen (from Blender):
             menu rows, or the live QR scanner when opened from SCAN --- */}
      <div className="octo-menu-wrap">
        <div className={`octo-menu-clip${panelOpen ? " is-open" : ""}`}>
          <div className="octo-menu-clipinner">
            <div className="octo-menu-screen">
              {scanOpen ? (
                <ScreenScanner active={scanOpen} onDetected={handleScan} />
              ) : (
              <div
                className="octo-screen-ui"
                role="menu"
                aria-label="More"
                aria-hidden={!menuOpen}
                ref={screenUiRef}
                tabIndex={-1}
                onKeyDown={onMenuKeyDown}
              >
                {menu.map((item) => {
                  const on = isActive(item.href);
                  return (
                    <div
                      key={item.href}
                      className={`octo-menu-item${on ? " is-active" : ""}`}
                      role="menuitem"
                      tabIndex={menuOpen ? 0 : -1}
                      aria-current={on ? "page" : undefined}
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(item.href);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setMenuOpen(false);
                          router.push(item.href);
                        }
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="octo-inner" ref={innerRef}>
        {/* reframed viewBox trims the source's demo whitespace, art unchanged */}
        <svg viewBox="46 118 1824 572">
          <defs>
            {/*
              Real bloom: a 4-level Gaussian pyramid accumulated additively
              (screen) in linear-light space, then an overexposed hot core on
              top. This is genuine multi-scale light bleed, not a single glow.
            */}
            <filter
              id="illuminate"
              x="-100%"
              y="-80%"
              width="300%"
              height="300%"
              colorInterpolationFilters="linearRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="g1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="g2" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="g3" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="30" result="g4" />
              <feBlend in="g4" in2="g3" mode="screen" result="a" />
              <feBlend in="a" in2="g2" mode="screen" result="b" />
              <feBlend in="b" in2="g1" mode="screen" result="halo" />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1.4 0.3  0.15 0 0.10
                        0.9 1.25 0.2  0 0.07
                        0.4 0.4  1.15 0 0.03
                        0   0    0    1 0"
                result="hot"
              />
              <feMerge>
                <feMergeNode in="halo" />
                <feMergeNode in="hot" />
              </feMerge>
            </filter>

            {/*
              GLOBAL ILLUMINATION — same bloom as #illuminate, but the blur radii
              are scaled ~0.22x so the on-screen glow matches when the filter is
              applied to normal-DPI HTML (the octagon runs this filter inside a
              ~0.22-scaled SVG viewBox). Use `filter:url(#illuminate-ui)` +
              colour #F5852A to illuminate any HTML icon/text identically to the
              bottom bar. Documented in global.md.
            */}
            <filter
              id="illuminate-ui"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
              colorInterpolationFilters="linearRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="ug1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="ug2" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="ug3" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="6.6" result="ug4" />
              <feBlend in="ug4" in2="ug3" mode="screen" result="ua" />
              <feBlend in="ua" in2="ug2" mode="screen" result="ub" />
              <feBlend in="ub" in2="ug1" mode="screen" result="uhalo" />
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values="1.4 0.3  0.15 0 0.10
                        0.9 1.25 0.2  0 0.07
                        0.4 0.4  1.15 0 0.03
                        0   0    0    1 0"
                result="uhot"
              />
              <feMerge>
                <feMergeNode in="uhalo" />
                <feMergeNode in="uhot" />
              </feMerge>
            </filter>
          </defs>

          {/* --- octagon frame (verbatim) --- */}
          <path
            className="octo-bg"
            d="M 59 340 L 59 600 L 63 610 L 124 670 L 135 674 L 718 674 L 729 670 L 757 649 L 1158 649 L 1189 672 L 1197 674 L 1780 674 L 1791 670 L 1851 611 L 1856 600 L 1856 340 L 1853 331 L 1773 251 L 1763 247 L 1183 247 L 1181 235 L 1177 228 L 1089 139 L 1076 131 L 839 131 L 833 133 L 737 229 L 734 236 L 733 247 L 151 247 L 142 251 L 62 331 Z"
            fill="#000"
          />
          <path
            d="M 70.0 341.8 L 70.0 597.9 L 72.4 603.8 L 130.0 660.5 L 136.9 663.0 L 716.1 663.0 L 723.7 660.2 L 751.2 639.6 L 757.0 638.0 L 1159.0 638.0 L 1164.6 640.2 L 1193.8 661.9 L 1198.4 663.0 L 1778.1 663.0 L 1785.0 660.5 L 1841.8 604.6 L 1845.0 597.6 L 1845.0 341.8 L 1843.4 336.9 L 1766.8 260.4 L 1760.9 258.0 L 1180.8 257.8 L 1176.8 256.1 L 1173.2 251.9 L 1170.5 238.7 L 1168.2 234.7 L 1082.1 147.7 L 1072.9 142.0 L 838.9 142.6 L 746.3 235.3 L 742.7 252.1 L 739.1 256.1 L 734.1 257.9 L 153.3 258.0 L 148.3 260.2 L 71.6 336.9 L 70.0 341.8 Z"
            fill="none"
            stroke="#3e3e3e"
            strokeWidth="22"
            strokeLinejoin="round"
          />
          <path
            d="M 100.0 351.0 L 100.0 588.9 L 144.9 633.0 L 710.0 633.0 L 738.8 612.3 L 757.0 608.0 L 1161.7 608.2 L 1179.3 614.0 L 1205.2 633.0 L 1770.2 633.0 L 1815.0 588.9 L 1815.0 351.0 L 1752.0 288.0 L 1174.8 287.2 L 1163.3 282.9 L 1153.5 275.5 L 1146.4 265.4 L 1142.1 251.0 L 1064.0 172.0 L 852.0 172.0 L 773.9 250.1 L 771.0 262.5 L 762.1 275.9 L 752.4 283.1 L 741.0 287.2 L 163.0 288.0 L 100.0 351.0 Z"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="5"
          />

          {/* --- HOME --- */}
          <g className={cls(homeA)} style={bloom(homeA)} onClick={go("/")} role="link" aria-label="Home">
            <rect x="150" y="320" width="220" height="290" fill="transparent" />
            <g transform="translate(200.0 345.0) scale(5.1250)">
              <g
                fill="none"
                stroke={homeA ? ORANGE : GRAY}
                strokeWidth="1.56"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 10.4 12 3l9 7.4" />
                <path d="M5.4 9.1V20a1 1 0 0 0 1 1h11.2a1 1 0 0 0 1-1V9.1" />
                <path d="M9.6 21v-6.2h4.8V21" />
              </g>
            </g>
            <text x="205" y="551" textLength="114" lengthAdjust="spacingAndGlyphs" fontSize="47" fill={homeA ? ORANGE : GRAY}>
              HOME
            </text>
            <rect x="234" y="586" width="54" height="8" rx="4.0" fill={homeA ? ORANGE : DIM} />
          </g>

          {/* --- REWARDS --- */}
          <g className={cls(rewA)} style={bloom(rewA)} onClick={go("/rewards")} role="link" aria-label="Rewards">
            <rect x="455" y="320" width="250" height="290" fill="transparent" />
            <g transform="translate(520.0 342.5) scale(5.3333)">
              <g
                fill="none"
                stroke={rewA ? ORANGE : GRAY}
                strokeWidth="1.50"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3.2" y="8" width="17.6" height="3.8" rx="1" />
                <path d="M12 8v13" />
                <path d="M18.9 11.8V19a2 2 0 0 1-2 2H7.1a2 2 0 0 1-2-2v-7.2" />
                <path d="M7.6 8a2.4 2.4 0 0 1 0-4.8C10.1 3.2 12 8 12 8s1.9-4.8 4.4-4.8a2.4 2.4 0 0 1 0 4.8" />
              </g>
            </g>
            <text x="484" y="551" textLength="197" lengthAdjust="spacingAndGlyphs" fontSize="47" fill={rewA ? ORANGE : GRAY}>
              REWARDS
            </text>
            <rect x="556" y="586" width="54" height="8" rx="4.0" fill={rewA ? ORANGE : DIM} />
          </g>

          {/* --- SHOP (Messages moved into the drop-up menu) --- */}
          <g className={cls(shopA)} style={bloom(shopA)} onClick={go("/shop")} role="link" aria-label="Shop">
            <rect x="1195" y="320" width="270" height="290" fill="transparent" />
            <g transform="translate(1269.5 345.0) scale(5.3333)">
              <g
                fill="none"
                stroke={shopA ? ORANGE : GRAY}
                strokeWidth="1.50"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2.2 3.2 6v13.6a2 2 0 0 0 2 2h13.6a2 2 0 0 0 2-2V6L18 2.2Z" />
                <path d="M3.2 6h17.6" />
                <path d="M16 9.8a4 4 0 0 1-8 0" />
              </g>
            </g>
            <text x="1272" y="551" textLength="116" lengthAdjust="spacingAndGlyphs" fontSize="47" fill={shopA ? ORANGE : GRAY}>
              SHOP
            </text>
            <rect x="1305" y="586" width="54" height="8" rx="4.0" fill={shopA ? ORANGE : DIM} />
          </g>

          {/* --- MENU (grid icon; opens the drop-up menu instead of navigating) --- */}
          <g
            className={cls(menuA)}
            style={bloom(menuA)}
            onClick={() => {
              // opening MENU always closes the scanner screen first
              setScanOpen(false);
              setMenuOpen((o) => !o);
            }}
            role="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            <rect x="1540" y="320" width="230" height="290" fill="transparent" />
            <g transform="translate(1584.0 340.0) scale(5.6250)">
              <g
                fill="none"
                stroke={menuA ? ORANGE : GRAY}
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
              </g>
            </g>
            <text x="1597" y="551" textLength="116" lengthAdjust="spacingAndGlyphs" fontSize="47" fill={menuA ? ORANGE : GRAY}>
              MENU
            </text>
            <rect x="1625" y="586" width="54" height="8" rx="4.0" fill={menuA ? ORANGE : DIM} />
          </g>

          {/* --- SCAN (center; opens the in-screen QR scanner, no page) --- */}
          <g
            className={cls(scanA)}
            style={bloom(scanA)}
            onClick={() => {
              setMenuOpen(false);
              setScanOpen((o) => !o);
            }}
            role="button"
            aria-haspopup="dialog"
            aria-expanded={scanOpen}
            aria-label="Scan"
          >
            <rect x="815" y="205" width="280" height="430" fill="transparent" />
            <path d="M 854.5 287.9 V 243.6 Q 854.5 227.5 870.6 227.5 H 914.9" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" strokeLinecap="round" />
            <path d="M 1001.1 227.5 H 1045.4 Q 1061.5 227.5 1061.5 243.6 V 287.9" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" strokeLinecap="round" />
            <path d="M 1061.5 379.1 V 423.4 Q 1061.5 439.5 1045.4 439.5 H 1001.1" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" strokeLinecap="round" />
            <path d="M 914.9 439.5 H 870.6 Q 854.5 439.5 854.5 423.4 V 379.1" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" strokeLinecap="round" />
            <rect x="893.6" y="267.8" width="48.3" height="48.3" rx="11.5" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" />
            <rect x="893.6" y="351.0" width="48.3" height="48.3" rx="11.5" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" />
            <rect x="974.1" y="267.8" width="48.3" height="48.3" rx="11.5" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" />
            <rect x="974.1" y="351.0" width="48.3" height="48.3" rx="11.5" fill="none" stroke={scanA ? ORANGE : GRAY} strokeWidth="15.0" />
            <text x="866" y="553" textLength="182" lengthAdjust="spacingAndGlyphs" fontSize="63" fill={scanA ? ORANGE : GRAY}>
              SCAN
            </text>
            <rect x="861" y="605" width="194" height="8" rx="4" fill={scanA ? ORANGE : DIM} />
          </g>
        </svg>
      </div>
    </nav>
  );
};
