"use client";

// Home "people" strip — the discoverable entry point for admin ↔ client chat.
//  - Clients see admins/owners (online-first) → tap to chat with an admin.
//  - Admins/owners see all clients with online/offline status → tap to chat.
// Tapping opens (or creates) a 1:1 conversation and jumps to the thread.
// Renders nothing when signed out or when there's no one to show.

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { isAdminRole } from "@/lib/types/roles";
import { listOrgUsers, type DirectoryUser } from "@/lib/services/directory";
import { getOrCreateDirectConversation } from "@/lib/services/conversation-service";
import { listenPresence } from "@/lib/services/presence-service";

export function PeopleStrip() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const org = user?.organizationId;
  const admin = isAdminRole(user?.role);

  const [people, setPeople] = useState<DirectoryUser[]>([]);
  const [online, setOnline] = useState<Record<string, boolean>>({});
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (!org || !uid) return;
    listOrgUsers(org)
      .then((users) =>
        setPeople(
          users.filter((u) =>
            u.uid !== uid && (admin ? u.role === "client" : isAdminRole(u.role)),
          ),
        ),
      )
      .catch(() => setPeople([]));
  }, [org, uid, admin]);

  useEffect(() => {
    if (!people.length) return;
    const unsubs = people.map((p) =>
      listenPresence(p.uid, (pr) =>
        setOnline((o) => ({ ...o, [p.uid]: pr?.state === "online" })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [people]);

  // Online first, then alphabetical.
  const sorted = useMemo(
    () =>
      [...people].sort((a, b) => {
        const oa = online[a.uid] ? 1 : 0;
        const ob = online[b.uid] ? 1 : 0;
        if (oa !== ob) return ob - oa;
        return (a.displayName || a.email).localeCompare(b.displayName || b.email);
      }),
    [people, online],
  );

  const onlineCount = sorted.filter((p) => online[p.uid]).length;

  const chat = async (otherUid: string) => {
    if (!uid || !org) return;
    setStarting(otherUid);
    try {
      const id = await getOrCreateDirectConversation({ uid, organizationId: org }, otherUid);
      router.push(`/messages?c=${encodeURIComponent(id)}`);
    } catch {
      setStarting(null);
    }
  };

  if (!uid || !org) return null;

  return (
    <div className="ps">
      <style>{css}</style>
      <div className="ps-head">
        <span className="ps-title">{admin ? "Clients" : "Chat with an Admin"}</span>
        <span className="ps-count">{onlineCount} online</span>
      </div>

      {sorted.length === 0 ? (
        <div className="ps-empty">{admin ? "No clients yet." : "No admins available."}</div>
      ) : (
        <div className="ps-row">
          {sorted.map((p) => {
            const on = !!online[p.uid];
            const name = p.displayName || p.email.split("@")[0];
            return (
              <button
                key={p.uid}
                className={`ps-person${on ? " on" : ""}`}
                onClick={() => chat(p.uid)}
                disabled={starting === p.uid}
                title={`${name} · ${on ? "Online" : "Offline"}`}
              >
                <span className="ps-av">
                  {name.charAt(0).toUpperCase()}
                  <span className={`ps-dot ${on ? "on" : "off"}`} />
                </span>
                <span className="ps-name">{name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const css = `
  .ps{--o:#F5852A;max-width:480px;margin:0 auto 14px;padding:0 14px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .ps-head{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 10px}
  .ps-title{font-size:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
  .ps-count{font-size:12px;font-weight:600;letter-spacing:1px;color:#31c07a}
  .ps-empty{font-size:13px;color:#7C7C7C;padding:6px 2px}
  .ps-row{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 8px;scrollbar-width:thin}
  .ps-row::-webkit-scrollbar{height:5px}
  .ps-row::-webkit-scrollbar-thumb{background:rgba(245,133,42,.4);border-radius:99px}
  .ps-person{flex:none;width:66px;display:flex;flex-direction:column;align-items:center;gap:6px;
    background:none;border:none;cursor:pointer;color:inherit;font-family:inherit;padding:0}
  .ps-person:disabled{opacity:.5}
  .ps-av{position:relative;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;
    background:#241608;color:var(--o);font-size:22px;font-weight:700;font-family:'Chakra Petch','Saira',sans-serif;
    border:2px solid #3a2a15;transition:border-color .18s,filter .2s}
  .ps-person.on .ps-av{border-color:var(--o);filter:drop-shadow(0 0 6px rgba(245,133,42,.4))}
  .ps-person:hover .ps-av{border-color:var(--o)}
  .ps-dot{position:absolute;right:-1px;bottom:-1px;width:14px;height:14px;border-radius:50%;border:2.5px solid #000}
  .ps-dot.on{background:#31c07a;box-shadow:0 0 6px rgba(49,192,122,.8)}
  .ps-dot.off{background:#555}
  .ps-name{font-size:11px;color:#cfcfcf;max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
`;
