"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { ROLE_LABELS } from "@/lib/types/roles";

// Global top header — styled after the dashboard's header row: an orange accent
// + logo + brand on the left, and on the right an auth control and an angled
// orange section that shows the current active page.
//
// SEARCH_EVENT is kept exported for the dashboard's filter subscription (the
// search control now lives elsewhere; the constant must remain for import
// compatibility).
export const SEARCH_EVENT = "activelyte:search";

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/rewards": "Rewards",
  "/scan": "Scan",
  "/messages": "Messages",
  "/shop": "Shop",
  "/profile": "Profile",
  "/notifications": "Notifications",
  "/settings": "Settings",
  "/admin/members": "Members",
  "/admin/shops": "Shops",
  "/admin/catalog": "Catalog",
};

const css = `
  .gh-bar{
    /* z-index above the bottom-nav scrim (z 50) so the drop-up menu's backdrop
       blur never falls on the header — it stays sharp while the menu is open */
    position:fixed;top:0;left:0;right:0;z-index:60;box-sizing:border-box;
    /* identical to a home-page list row: the home artboard is a 1180px canvas
       scaled to the viewport width, so each 74px row renders at
       74 * (100vw / 1180). The header is full-width, so the same formula makes
       its height track the rows exactly across desktop and tablet. */
    height:calc(100vw * 74 / 1180);padding-top:env(safe-area-inset-top);
    display:flex;align-items:stretch;
    /* same "active row" effect as the highlighted dashboard row:
       orange border + brown gradient over black */
    background:linear-gradient(90deg,rgba(90,46,8,.85),rgba(24,14,5,.55)),#000;
    border:2px solid #F5852A;border-radius:6px;
    font-family:'Saira',sans-serif;overflow:hidden;
  }
  .gh-bar *{box-sizing:border-box}

  .gh-left{display:flex;align-items:center;gap:13px;padding:0 16px;flex:1 1 auto;min-width:0}
  .gh-logo{width:52px;height:52px;flex:none;display:grid;place-items:center;color:#F5852A}
  .gh-logo svg{width:46px;height:46px}
  .gh-titles{min-width:0;line-height:1.05}
  .gh-title{color:#F2F2F2;font-size:23px;font-weight:600;letter-spacing:2px;text-transform:uppercase;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  .gh-right{display:flex;align-items:stretch;flex:none;height:100%}
  .gh-auth{display:flex;align-items:center;gap:11px;padding:0 18px;cursor:pointer;background:none;
    border:none;font-family:inherit;white-space:nowrap;transition:background-color .18s ease}
  .gh-auth:hover{background:rgba(255,255,255,.04)}
  .gh-avatar{width:34px;height:34px;border-radius:50%;border:1.5px solid #6a6a6a;overflow:hidden;
    flex:none;display:grid;place-items:center;background:#242424;color:#cfcfcf}
  .gh-avatar svg{width:100%;height:100%;display:block}
  .gh-auth-txt{font-size:15px;font-weight:600;letter-spacing:2px;color:#F0842E;text-transform:uppercase}
  .gh-auth:hover .gh-auth-txt{color:#ffa245}
  .gh-auth-txt .sm{display:none}

  .gh-active{display:flex;align-items:center;padding:0 26px 0 40px;background:#F5852A;flex:none;
    clip-path:polygon(28px 0,100% 0,100% 100%,0 100%)}
  .gh-active .lbl{color:#2a1c07;font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
    white-space:nowrap}

  @media (max-width:640px){
    /* mobile: the artboard reflows to a flowing list whose rows are
       min-height:60px — match that so the header reads as another row */
    .gh-bar{height:60px}
    .gh-logo{width:42px;height:42px}
    .gh-logo svg{width:38px;height:38px}
    .gh-left{gap:10px;padding:0 12px}
    .gh-title{font-size:18px;letter-spacing:1px}
    .gh-auth{padding:0 12px;gap:8px}
    .gh-avatar{width:30px;height:30px}
    .gh-auth-txt{font-size:12px;letter-spacing:1px}
    .gh-auth-txt .lg{display:none}
    .gh-auth-txt .sm{display:inline}
    .gh-active{padding:0 15px 0 26px;clip-path:polygon(18px 0,100% 0,100% 100%,0 100%)}
    .gh-active .lbl{font-size:12px;letter-spacing:2px}
  }
`;

export const TopHeader: React.FC = () => {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  const { user, loading, openAuth, signOut } = useAuth();
  const loggedIn = !!user;

  // Publish the fixed bar's height so page content can reserve space beneath it.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        "--top-header-h",
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

  const pageLabel =
    PAGE_LABELS[pathname] ??
    (pathname.replace(/^\//, "").split("/")[0] || "Home");

  const firstName = (u: typeof user) => {
    const name = u?.displayName?.trim() || u?.email?.split("@")[0] || "Account";
    return name.split(/\s+/)[0];
  };

  return (
    <header className="gh-bar" ref={barRef}>
      <style>{css}</style>

      <div className="gh-left">
        <span className="gh-logo" aria-hidden>
          {/* activity pulse — "Activelyte" */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </span>
        <div className="gh-titles">
          <div className="gh-title">Activelyte</div>
        </div>
      </div>

      <div className="gh-right">
        <button
          type="button"
          className="gh-auth"
          onClick={() => (loggedIn ? void signOut() : openAuth("login"))}
          disabled={loading}
          aria-label={loggedIn ? "Log out" : "Log in or sign up"}
          title={
            loggedIn
              ? `${user?.email ?? ""}${user?.role ? ` — ${ROLE_LABELS[user.role]}` : ""} · Logout`
              : undefined
          }
        >
          <span className="gh-avatar" aria-hidden>
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="9" r="4" />
                <path d="M4.5 21a7.5 7.5 0 0 1 15 0z" />
              </svg>
            )}
          </span>
          <span className="gh-auth-txt">
            {loading ? (
              "…"
            ) : loggedIn ? (
              <>
                <span className="lg">{firstName(user)}</span>
                <span className="sm">Logout</span>
              </>
            ) : (
              <>
                <span className="lg">Login / Sign up</span>
                <span className="sm">Sign in</span>
              </>
            )}
          </span>
        </button>

        <div className="gh-active" aria-label={`Current page: ${pageLabel}`}>
          <span className="lbl">{pageLabel}</span>
        </div>
      </div>
    </header>
  );
};
