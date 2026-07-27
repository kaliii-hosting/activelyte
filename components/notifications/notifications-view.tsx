"use client";

// In-app notifications list. Real-time via Firestore (rule-gated to the current
// user). Tapping a notification marks it read and navigates to its target.

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  listenMyNotifications,
  markNotificationRead,
} from "@/lib/services/notification-service";
import type { AppNotification } from "@/lib/types/models";

const ICONS: Record<string, string> = {
  message: "💬",
  broadcast: "📢",
  points_earned: "⭐",
  reward_approved: "✅",
  reward_rejected: "⚠️",
  announcement: "📣",
};

export function NotificationsView() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return listenMyNotifications(user.uid, setItems);
  }, [user?.uid]);

  const open = async (n: AppNotification) => {
    if (!n.read) void markNotificationRead(n.id);
    const target = n.data?.conversationId ? "/messages" : null;
    if (target) router.push(target);
  };

  const timeLabel = (v: unknown) => {
    const ms =
      v && typeof (v as { toMillis?: () => number }).toMillis === "function"
        ? (v as { toMillis: () => number }).toMillis()
        : 0;
    return ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  };

  return (
    <div className="nt">
      <style>{css}</style>
      <div className="nt-head"><h1>Notifications</h1></div>
      {items === null ? (
        <div className="nt-empty">Loading…</div>
      ) : items.length === 0 ? (
        <div className="nt-empty">You’re all caught up.</div>
      ) : (
        <ul className="nt-list">
          {items.map((n) => (
            <li key={n.id}>
              <button className={`nt-row${n.read ? "" : " unread"}`} onClick={() => open(n)}>
                <span className="nt-ic" aria-hidden>{ICONS[n.type] ?? "🔔"}</span>
                <span className="nt-body">
                  <span className="nt-title">{n.title}</span>
                  <span className="nt-text">{n.body}</span>
                  <span className="nt-time">{timeLabel(n.createdAt)}</span>
                </span>
                {!n.read && <span className="nt-dot" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const css = `
  .nt{max-width:640px;margin:0 auto;padding:18px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .nt-head h1{font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px}
  .nt-empty{color:#7C7C7C;font-size:14px;padding:30px;text-align:center}
  .nt-list{list-style:none;margin:0;padding:0}
  .nt-row{width:100%;display:flex;align-items:flex-start;gap:12px;padding:13px 12px;background:none;border:none;
    border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;text-align:left;color:inherit;font-family:inherit}
  .nt-row.unread{background:linear-gradient(90deg,rgba(90,46,8,.32),transparent)}
  .nt-row:hover{background:rgba(255,255,255,.03)}
  .nt-ic{font-size:22px;line-height:1;flex:none;margin-top:2px}
  .nt-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .nt-title{font-size:15px;font-weight:600}
  .nt-text{font-size:13px;color:#9a9a9a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nt-time{font-size:11px;color:#7C7C7C;margin-top:2px}
  .nt-dot{width:9px;height:9px;border-radius:50%;background:#F5852A;flex:none;margin-top:6px}
`;
