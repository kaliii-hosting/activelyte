"use client";

// Client-side route guard. Wrap protected page content in <RouteGuard> to gate
// on authentication and (optionally) a minimum role.
//
// IMPORTANT: this is UX only. It hides content and nudges sign-in, but it is
// NOT a security boundary — a determined client can render anything. Real
// enforcement is in Firestore/Storage Security Rules and Cloud Functions. Never
// rely on this guard to protect data.

import React, { useEffect } from "react";
import { useAuth } from "./auth-provider";
import { hasAtLeast, ROLE_LABELS, type Role } from "@/lib/types/roles";

export function RouteGuard({
  children,
  requireRole,
  title = "Sign in required",
}: {
  children: React.ReactNode;
  /** Minimum role needed; omit to require only authentication. */
  requireRole?: Role;
  title?: string;
}) {
  const { user, loading, configured, openAuth } = useAuth();

  // Auto-open the auth dialog when an unauthenticated user lands here.
  useEffect(() => {
    if (!loading && configured && !user) openAuth("login");
  }, [loading, configured, user, openAuth]);

  if (!configured) {
    return (
      <GuardShell>
        <p className="rg-title">Backend not configured</p>
        <p className="rg-sub">
          Add your Firebase keys to <code>.env.local</code> to enable accounts.
        </p>
      </GuardShell>
    );
  }

  if (loading) {
    return (
      <GuardShell>
        <span className="rg-spinner" aria-hidden />
        <p className="rg-sub">Loading…</p>
      </GuardShell>
    );
  }

  if (!user) {
    return (
      <GuardShell>
        <p className="rg-title">{title}</p>
        <p className="rg-sub">Sign in to continue.</p>
        <button className="rg-btn" onClick={() => openAuth("login")}>
          Sign In
        </button>
      </GuardShell>
    );
  }

  if (requireRole && !hasAtLeast(user.role, requireRole)) {
    return (
      <GuardShell>
        <p className="rg-title">Not authorized</p>
        <p className="rg-sub">
          This area requires {ROLE_LABELS[requireRole]} access or higher.
        </p>
      </GuardShell>
    );
  }

  return <>{children}</>;
}

function GuardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rg-wrap">
      <style>{`
        .rg-wrap{min-height:calc(100dvh - var(--top-header-h,56px) - var(--bottom-nav-h,160px) - 60px);
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:12px;text-align:center;padding:40px 24px;font-family:'Saira',sans-serif}
        .rg-title{color:#F2F2F2;font-size:20px;font-weight:700;letter-spacing:2px;
          text-transform:uppercase;margin:0}
        .rg-sub{color:#8C8C8C;font-size:14px;margin:0;max-width:320px;line-height:1.5}
        .rg-sub code{color:#F0842E;font-family:'Geist Mono',monospace;font-size:13px}
        .rg-btn{margin-top:6px;height:44px;padding:0 28px;border:none;border-radius:5px;
          background:#F5852A;color:#1a1103;font-family:'Rajdhani',sans-serif;font-size:16px;
          font-weight:700;letter-spacing:3px;text-transform:uppercase;cursor:pointer}
        .rg-btn:hover{filter:brightness(1.08)}
        .rg-spinner{width:26px;height:26px;border-radius:50%;border:3px solid rgba(245,133,42,.25);
          border-top-color:#F5852A;animation:rg-spin .8s linear infinite}
        @keyframes rg-spin{to{transform:rotate(360deg)}}
      `}</style>
      {children}
    </div>
  );
}
