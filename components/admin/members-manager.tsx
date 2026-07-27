"use client";

// Founder/admin members management: view organization users, change roles,
// enable/disable accounts, and invite new users by email. Styled with the
// dashboard's row design tokens so it reads as native Activelyte.
//
// All mutations go through the admin API (which re-checks authorization on the
// verified caller token); this UI only shows what the caller is allowed to do.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { assignableRoles, canManageUser } from "@/lib/authz";
import { ROLE_LABELS, type Role } from "@/lib/types/roles";
import { listenPresence } from "@/lib/services/presence-service";

type Member = {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  status: "active" | "invited" | "disabled";
  organizationId: string;
  photoURL?: string;
};

export function MembersManager() {
  const { user } = useAuth();
  const callerRole = user?.role;
  const grantable = assignableRoles(callerRole);

  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [online, setOnline] = useState<Record<string, boolean>>({});

  // Live online presence for every listed member (one RTDB listener each).
  useEffect(() => {
    if (!members) return;
    const unsubs = members.map((m) =>
      listenPresence(m.uid, (p) =>
        setOnline((o) => ({ ...o, [m.uid]: p?.state === "online" })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [members]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { users } = await apiFetch<{ users: Member[] }>("/api/admin/users");
      setMembers(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (m: Member, role: Role) => {
    if (role === m.role) return;
    setBusyUid(m.uid);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/admin/users/assign-role", {
        method: "POST",
        body: { uid: m.uid, role },
      });
      setNotice(`${m.displayName || m.email} is now ${ROLE_LABELS[role]}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change role.");
    } finally {
      setBusyUid(null);
    }
  };

  const toggleStatus = async (m: Member) => {
    const status = m.status === "disabled" ? "active" : "disabled";
    setBusyUid(m.uid);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/admin/users/status", {
        method: "POST",
        body: { uid: m.uid, status },
      });
      setNotice(`${m.displayName || m.email} ${status === "disabled" ? "disabled" : "enabled"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusyUid(null);
    }
  };

  const deleteMember = async (m: Member) => {
    if (!window.confirm(`Permanently delete ${m.displayName || m.email}? This can't be undone.`)) return;
    setBusyUid(m.uid);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/api/admin/users/delete", { method: "POST", body: { uid: m.uid } });
      setNotice(`${m.displayName || m.email} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <section className="mm">
      <style>{css}</style>

      <div className="mm-head">
        <h1>Members</h1>
        <p>Manage roles and access for your organization.</p>
      </div>

      {error && <div className="mm-alert error">{error}</div>}
      {notice && <div className="mm-alert ok">{notice}</div>}

      <InviteForm grantable={grantable} onInvited={(msg) => { setNotice(msg); void load(); }} onError={setError} />

      {members === null ? (
        <div className="mm-empty">Loading members…</div>
      ) : members.length === 0 ? (
        <div className="mm-empty">No members found.</div>
      ) : (
        <ul className="mm-list">
          {members.map((m) => {
            const isSelf = m.uid === user?.uid;
            const manageable = !isSelf && canManageUser(callerRole, m.role);
            // Options: the roles the caller may grant, plus the member's current
            // role so the select shows their real state even if unmanageable.
            const options = Array.from(new Set<Role>([m.role, ...grantable]));
            return (
              <li key={m.uid} className={`mm-row${m.status === "disabled" ? " off" : ""}`}>
                <span className="mm-av" aria-hidden>
                  {m.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoURL} alt="" />
                  ) : (
                    (m.displayName || m.email || "?").charAt(0).toUpperCase()
                  )}
                  <span
                    className={`mm-presence ${online[m.uid] ? "on" : "off"}`}
                    title={online[m.uid] ? "Online" : "Offline"}
                  />
                </span>
                <div className="mm-id">
                  <div className="mm-name">
                    {m.displayName || "—"}
                    {isSelf && <span className="mm-you">you</span>}
                    {m.status === "invited" && <span className="mm-badge">invited</span>}
                    {m.status === "disabled" && <span className="mm-badge off">disabled</span>}
                  </div>
                  <div className="mm-email">{m.email}</div>
                </div>

                <div className="mm-actions">
                  <select
                    className="mm-role"
                    value={m.role}
                    disabled={!manageable || busyUid === m.uid}
                    onChange={(e) => changeRole(m, e.target.value as Role)}
                    aria-label={`Role for ${m.displayName || m.email}`}
                  >
                    {options.map((r) => (
                      <option key={r} value={r} disabled={r === "founder"}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {manageable && (
                    <>
                      <button
                        className="mm-toggle"
                        disabled={busyUid === m.uid}
                        onClick={() => toggleStatus(m)}
                      >
                        {m.status === "disabled" ? "Enable" : "Disable"}
                      </button>
                      <button
                        className="mm-delete"
                        disabled={busyUid === m.uid}
                        onClick={() => deleteMember(m)}
                        aria-label={`Delete ${m.displayName || m.email}`}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function InviteForm({
  grantable,
  onInvited,
  onError,
}: {
  grantable: Role[];
  onInvited: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>(grantable[grantable.length - 1] ?? "client");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  if (grantable.length === 0) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setLink(null);
    onError("");
    try {
      const res = await apiFetch<{ setupLink: string }>("/api/admin/users/invite", {
        method: "POST",
        body: { email: email.trim(), displayName: displayName.trim(), role },
      });
      setLink(res.setupLink);
      onInvited(`Invited ${email.trim()} as ${ROLE_LABELS[role]}.`);
      setEmail("");
      setDisplayName("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-invite">
      <button className="mm-invite-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "− Cancel invite" : "+ Invite member"}
      </button>
      {open && (
        <form className="mm-invite-form" onSubmit={submit}>
          <input
            type="text"
            placeholder="Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {grantable.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy}>
            {busy ? "Inviting…" : "Send invite"}
          </button>
        </form>
      )}
      {link && (
        <div className="mm-link">
          <span>Password-setup link (send to them):</span>
          <code>{link}</code>
        </div>
      )}
    </div>
  );
}

const css = `
  .mm{max-width:760px;margin:0 auto;padding:20px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .mm-head h1{font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .mm-head p{color:#8C8C8C;font-size:14px;margin:4px 0 18px}

  .mm-alert{margin:0 0 14px;padding:10px 12px;border-radius:5px;font-size:13px;border:1px solid;line-height:1.4}
  .mm-alert.error{background:rgba(255,90,60,.08);border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .mm-alert.ok{background:rgba(31,138,104,.12);border-color:rgba(31,138,104,.5);color:#61d3a8}

  .mm-invite{margin-bottom:18px}
  .mm-invite-toggle{background:none;border:1px solid #4A4A4A;border-radius:5px;color:#F0842E;
    font-family:inherit;font-size:13px;font-weight:600;letter-spacing:1px;padding:8px 14px;cursor:pointer}
  .mm-invite-toggle:hover{border-color:#F5852A}
  .mm-invite-form{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .mm-invite-form input,.mm-invite-form select{height:40px;padding:0 12px;background:#0c0c0c;
    border:1.5px solid #333;border-radius:5px;color:#F2F2F2;font-family:inherit;font-size:14px;outline:none}
  .mm-invite-form input{flex:1 1 160px}
  .mm-invite-form input:focus,.mm-invite-form select:focus{border-color:#F5852A}
  .mm-invite-form button{height:40px;padding:0 18px;border:none;border-radius:5px;background:#F5852A;
    color:#1a1103;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .mm-invite-form button:disabled{opacity:.6}
  .mm-link{margin-top:10px;padding:10px 12px;background:#0c0c0c;border:1px solid #333;border-radius:5px}
  .mm-link span{display:block;font-size:12px;color:#8C8C8C;margin-bottom:4px}
  .mm-link code{font-family:'Geist Mono',monospace;font-size:11px;color:#F0842E;word-break:break-all}

  .mm-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
  .mm-row{display:flex;align-items:center;gap:14px;padding:12px 14px;
    border-bottom:1px solid rgba(255,255,255,.07)}
  .mm-row.off{opacity:.55}
  .mm-av{position:relative;width:40px;height:40px;flex:none;border-radius:50%;border:1.5px solid #666;
    display:grid;place-items:center;background:#242424;color:#cfcfcf;font-weight:700;font-size:16px}
  .mm-av img{width:100%;height:100%;object-fit:cover;border-radius:50%}
  .mm-presence{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;border-radius:50%;border:2px solid #0a0a0a}
  .mm-presence.on{background:#31c07a;box-shadow:0 0 6px rgba(49,192,122,.7)}
  .mm-presence.off{background:#555}
  .mm-id{flex:1;min-width:0}
  .mm-name{font-size:16px;font-weight:600;letter-spacing:.5px;display:flex;align-items:center;gap:8px}
  .mm-email{font-size:13px;color:#7C7C7C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mm-you{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#F0842E;
    border:1px solid rgba(245,133,42,.4);border-radius:3px;padding:1px 5px}
  .mm-badge{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8C8C8C;
    border:1px solid #4A4A4A;border-radius:3px;padding:1px 5px}
  .mm-badge.off{color:#ff8a5c;border-color:rgba(255,90,60,.4)}

  .mm-actions{display:flex;align-items:center;gap:8px;flex:none}
  .mm-role{height:36px;padding:0 10px;background:#0c0c0c;border:1.5px solid #333;border-radius:5px;
    color:#F2F2F2;font-family:inherit;font-size:13px;cursor:pointer}
  .mm-role:disabled{opacity:.5;cursor:default}
  .mm-role:focus{border-color:#F5852A;outline:none}
  .mm-toggle{height:36px;padding:0 12px;background:none;border:1.5px solid #4A4A4A;border-radius:5px;
    color:#cfcfcf;font-family:inherit;font-size:12px;font-weight:600;letter-spacing:1px;cursor:pointer}
  .mm-toggle:hover{border-color:#ff8a5c;color:#ff9c7a}
  .mm-toggle:disabled{opacity:.5}
  .mm-delete{height:36px;padding:0 12px;background:none;border:1.5px solid rgba(255,90,60,.4);border-radius:5px;
    color:#ff8a5c;font-family:inherit;font-size:12px;font-weight:600;letter-spacing:1px;cursor:pointer}
  .mm-delete:hover{border-color:#ff5a3c;background:rgba(255,90,60,.12)}
  .mm-delete:disabled{opacity:.5}

  .mm-empty{padding:30px;text-align:center;color:#7C7C7C;font-size:14px}

  @media (max-width:560px){
    .mm-row{flex-wrap:wrap}
    .mm-actions{width:100%;justify-content:flex-end}
  }
`;
