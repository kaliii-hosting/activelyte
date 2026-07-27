"use client";

// Unified Settings — role-aware, styled to match the homepage (Rewards) design.
// Everyone: profile, notification preferences, appearance, account.
// Admins/owners additionally: app management (org settings + shortcuts).

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { apiFetch } from "@/lib/api-client";
import { isAdminRole, ROLE_LABELS, type Role } from "@/lib/types/roles";
import {
  listenMyProfile,
  updateMyProfile,
  type UserPreferences,
} from "@/lib/services/profile-service";

type Field = { key: string; label: string; type: "text" | "number" | "bool" };
type AppSection = { id: string; title: string; fields: Field[] };

const APP_SECTIONS: AppSection[] = [
  { id: "general", title: "General", fields: [
    { key: "orgName", label: "Organization name", type: "text" },
    { key: "supportEmail", label: "Support email", type: "text" },
    { key: "timezone", label: "Time zone", type: "text" },
  ]},
  { id: "messaging", title: "Messaging", fields: [
    { key: "allowGroups", label: "Allow group chats", type: "bool" },
    { key: "allowBroadcasts", label: "Allow broadcasts", type: "bool" },
    { key: "maxGroupSize", label: "Max group size", type: "number" },
  ]},
  { id: "rewards", title: "Rewards", fields: [
    { key: "pointExpiryDays", label: "Point expiry (days, 0 = never)", type: "number" },
    { key: "requireApprovalDefault", label: "Require approval by default", type: "bool" },
  ]},
  { id: "scanning", title: "Scanner", fields: [
    { key: "manualEntryAllowed", label: "Allow manual code entry", type: "bool" },
    { key: "scanCooldownSeconds", label: "Scan cooldown (seconds)", type: "number" },
  ]},
  { id: "featureFlags", title: "Feature flags", fields: [
    { key: "messaging", label: "Messaging enabled", type: "bool" },
    { key: "rewards", label: "Rewards enabled", type: "bool" },
    { key: "scanner", label: "Scanner enabled", type: "bool" },
  ]},
];

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className={`sv-toggle${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="sv-knob" />
    </button>
  );
}

export function SettingsView() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  const isAdmin = isAdminRole(user?.role);

  const [toast, setToast] = useState<{ k: "ok" | "err"; t: string } | null>(null);
  const flash = (k: "ok" | "err", t: string) => { setToast({ k, t }); setTimeout(() => setToast(null), 3000); };

  // ---- profile ----
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<UserPreferences>({});
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return listenMyProfile(uid, (p) => {
      setName(p?.displayName ?? user?.displayName ?? "");
      setPrefs(p?.preferences ?? {});
    });
  }, [uid, user?.displayName]);

  const saveName = async () => {
    if (!uid) return;
    setSavingProfile(true);
    try { await updateMyProfile(uid, { displayName: name.trim() }); flash("ok", "Profile saved."); }
    catch (e) { flash("err", e instanceof Error ? e.message : "Save failed."); }
    finally { setSavingProfile(false); }
  };

  const setPref = async (key: keyof UserPreferences, value: boolean) => {
    if (!uid) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { await updateMyProfile(uid, { preferences: next }); }
    catch (e) { flash("err", e instanceof Error ? e.message : "Couldn't save preference."); }
  };

  // ---- appearance (device-local) ----
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setReduceMotion(localStorage.getItem("activelyte:reduceMotion") === "1");
  }, []);
  const toggleMotion = (v: boolean) => {
    setReduceMotion(v);
    localStorage.setItem("activelyte:reduceMotion", v ? "1" : "0");
  };

  // ---- admin app settings ----
  const [appValues, setAppValues] = useState<Record<string, Record<string, unknown>>>({});
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const loadApp = useCallback(async () => {
    if (!isAdmin) return;
    try { const d = await apiFetch<{ settings: typeof appValues }>("/api/admin/settings"); setAppValues(d.settings ?? {}); }
    catch { /* non-fatal */ }
  }, [isAdmin]);
  useEffect(() => { void loadApp(); }, [loadApp]);

  const setAppVal = (section: string, key: string, v: string | number | boolean) =>
    setAppValues((s) => ({ ...s, [section]: { ...(s[section] ?? {}), [key]: v } }));

  const saveSection = async (sec: AppSection) => {
    setSavingSection(sec.id);
    try {
      await apiFetch("/api/admin/settings", { method: "POST", body: { section: sec.id, values: appValues[sec.id] ?? {} } });
      flash("ok", `${sec.title} saved.`);
    } catch (e) { flash("err", e instanceof Error ? e.message : "Save failed."); }
    finally { setSavingSection(null); }
  };

  const initial = (name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="sv">
      <style>{css}</style>
      {toast && <div className={`sv-toast ${toast.k}`}>{toast.t}</div>}

      {/* ---- identity hero (beveled, like the home balance card) ---- */}
      <div className="sv-hero">
        <div className="sv-hero-inner">
          <span className="sv-avatar" aria-hidden>
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" />
            ) : initial}
          </span>
          <div className="sv-hero-txt">
            <div className="sv-hero-name">{name || "Your account"}</div>
            <div className="sv-hero-meta">
              {user?.role && <span className="sv-role">{ROLE_LABELS[user.role as Role]}</span>}
              <span className="sv-email">{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Profile ---- */}
      <Section title="Profile" icon={IC.user}>
        <div className="sv-field col">
          <label className="sv-flabel">Display name</label>
          <div className="sv-inline">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <button className="sv-save" disabled={savingProfile || name.trim().length < 2} onClick={saveName}>
              {savingProfile ? "…" : "Save"}
            </button>
          </div>
        </div>
        <div className="sv-field">
          <span className="sv-flabel">Email</span>
          <span className="sv-static">{user?.email}</span>
        </div>
      </Section>

      {/* ---- Notifications ---- */}
      <Section title="Notifications" icon={IC.bell}>
        <Row label="Push notifications">
          <Toggle on={!!prefs.pushEnabled} onChange={(v) => setPref("pushEnabled", v)} />
        </Row>
        <Row label="New messages">
          <Toggle on={prefs.notifyMessages !== false} onChange={(v) => setPref("notifyMessages", v)} />
        </Row>
        <Row label="Broadcasts">
          <Toggle on={prefs.notifyBroadcasts !== false} onChange={(v) => setPref("notifyBroadcasts", v)} />
        </Row>
        <Row label="Rewards & points">
          <Toggle on={prefs.notifyRewards !== false} onChange={(v) => setPref("notifyRewards", v)} />
        </Row>
      </Section>

      {/* ---- Appearance ---- */}
      <Section title="Appearance" icon={IC.spark}>
        <Row label="Reduce motion">
          <Toggle on={reduceMotion} onChange={toggleMotion} />
        </Row>
      </Section>

      {/* ---- Admin: management shortcuts ---- */}
      {isAdmin && (
        <Section title="Management" icon={IC.shield}>
          {[
            { href: "/admin/members", label: "Members & roles" },
            { href: "/admin/shops", label: "Shops & bartenders" },
            { href: "/admin/catalog", label: "Products & rewards" },
          ].map((l) => (
            <button key={l.href} className="sv-linkrow" onClick={() => router.push(l.href)}>
              <span>{l.label}</span>
              <span className="sv-chev">{IC.chev}</span>
            </button>
          ))}
        </Section>
      )}

      {/* ---- Admin: app settings ---- */}
      {isAdmin && APP_SECTIONS.map((sec) => (
        <Section key={sec.id} title={sec.title} icon={IC.gear} badge="Admin">
          {sec.fields.map((f) => {
            const cur = appValues[sec.id]?.[f.key];
            return (
              <Row key={f.key} label={f.label}>
                {f.type === "bool" ? (
                  <Toggle on={!!cur} onChange={(v) => setAppVal(sec.id, f.key, v)} />
                ) : (
                  <input
                    className="sv-input-sm"
                    type={f.type === "number" ? "number" : "text"}
                    value={cur === undefined ? "" : String(cur)}
                    onChange={(e) => setAppVal(sec.id, f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </Row>
            );
          })}
          <button className="sv-save wide" disabled={savingSection === sec.id} onClick={() => saveSection(sec)}>
            {savingSection === sec.id ? "Saving…" : `Save ${sec.title}`}
          </button>
        </Section>
      ))}

      {/* ---- Account ---- */}
      <Section title="Account" icon={IC.door}>
        <button className="sv-signout" onClick={() => void signOut()}>Sign out</button>
      </Section>

      <div className="sv-foot">Activelyte · v0.1</div>
    </div>
  );
}

function Section({ title, icon, badge, children }: { title: string; icon: React.ReactNode; badge?: string; children: React.ReactNode }) {
  return (
    <div className="sv-card">
      <div className="sv-card-head">
        <span className="sv-card-ic">{icon}</span>
        <span className="sv-card-title">{title}</span>
        {badge && <span className="sv-badge">{badge}</span>}
      </div>
      <div className="sv-card-body">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sv-field">
      <span className="sv-flabel">{label}</span>
      {children}
    </div>
  );
}

const IC: Record<string, React.ReactNode> = {
  user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>,
  spark: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>,
  door: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9" /><path d="M11 12h9M18 9l3 3-3 3" /></svg>,
  chev: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>,
};

const css = `
  .sv{--o:#F5852A;max-width:480px;margin:0 auto;padding:14px 14px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .sv *{box-sizing:border-box}
  .sv-toast{position:fixed;left:50%;top:calc(var(--top-header-h,56px) + 12px);transform:translateX(-50%);z-index:120;
    padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid}
  .sv-toast.ok{background:rgba(31,138,104,.18);border-color:#1F8A68;color:#61d3a8}
  .sv-toast.err{background:rgba(255,90,60,.12);border-color:rgba(255,90,60,.5);color:#ff9c7a}

  .sv-hero{position:relative;padding:2px;margin-bottom:16px;
    background:linear-gradient(135deg,var(--o),rgba(245,133,42,.35));
    clip-path:polygon(0 20px,20px 0,calc(100% - 42px) 0,100% 42px,100% 100%,42px 100%,0 calc(100% - 20px));
    filter:drop-shadow(0 0 12px rgba(245,133,42,.25))}
  .sv-hero-inner{display:flex;align-items:center;gap:16px;padding:20px 22px;
    background:radial-gradient(120% 120% at 15% 0%,rgba(245,133,42,.12),rgba(10,7,3,.96) 60%),#080604;
    clip-path:polygon(0 19px,19px 0,calc(100% - 41px) 0,100% 41px,100% 100%,41px 100%,0 calc(100% - 19px))}
  .sv-avatar{flex:none;width:64px;height:64px;border-radius:50%;border:2px solid var(--o);overflow:hidden;
    display:grid;place-items:center;background:#241608;color:var(--o);font-size:26px;font-weight:700;
    font-family:'Chakra Petch','Saira',sans-serif}
  .sv-avatar img{width:100%;height:100%;object-fit:cover}
  .sv-hero-name{font-size:22px;font-weight:700;letter-spacing:.5px}
  .sv-hero-meta{display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap}
  .sv-role{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--o);
    border:1px solid rgba(245,133,42,.5);border-radius:4px;padding:2px 7px}
  .sv-email{font-size:12px;color:#9a9a9a;word-break:break-all}

  .sv-card{border:1px solid #2a2a2a;border-radius:12px;background:#0b0b0b;margin-bottom:12px;overflow:hidden}
  .sv-card-head{display:flex;align-items:center;gap:9px;padding:13px 15px;border-bottom:1px solid rgba(255,255,255,.06)}
  .sv-card-ic{width:19px;height:19px;color:var(--o);flex:none}
  .sv-card-ic svg{width:100%;height:100%}
  .sv-card-title{font-size:15px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;flex:1}
  .sv-badge{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--o);
    border:1px solid rgba(245,133,42,.5);border-radius:4px;padding:2px 6px}
  .sv-card-body{padding:6px 15px 14px}

  .sv-field{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .sv-field:last-child{border-bottom:none}
  .sv-field.col{flex-direction:column;align-items:stretch;gap:7px}
  .sv-flabel{font-size:14px;color:#cfcfcf}
  .sv-static{font-size:13px;color:#8C8C8C;word-break:break-all;text-align:right}
  .sv-inline{display:flex;gap:8px}
  .sv-inline input{flex:1;height:42px;padding:0 13px;background:#0c0c0c;border:1.5px solid #333;border-radius:7px;
    color:#F2F2F2;font-family:inherit;font-size:15px;outline:none}
  .sv-inline input:focus,.sv-input-sm:focus{border-color:var(--o)}
  .sv-input-sm{width:120px;height:36px;padding:0 10px;background:#0c0c0c;border:1.5px solid #333;border-radius:6px;
    color:#F2F2F2;font-family:inherit;font-size:14px;outline:none;text-align:right}
  .sv-save{height:42px;padding:0 18px;border:none;border-radius:7px;background:var(--o);color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .sv-save.wide{width:100%;margin-top:12px;height:40px}
  .sv-save:disabled{opacity:.5}

  .sv-toggle{width:46px;height:26px;border-radius:99px;border:none;background:#333;position:relative;cursor:pointer;
    flex:none;transition:background .18s}
  .sv-toggle.on{background:var(--o)}
  .sv-toggle:disabled{opacity:.5}
  .sv-knob{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .18s}
  .sv-toggle.on .sv-knob{left:23px}

  .sv-linkrow{width:100%;display:flex;align-items:center;justify-content:space-between;padding:13px 0;background:none;
    border:none;border-bottom:1px solid rgba(255,255,255,.05);color:#F2F2F2;font-family:inherit;font-size:15px;cursor:pointer}
  .sv-linkrow:last-child{border-bottom:none}
  .sv-linkrow:hover{color:var(--o)}
  .sv-chev{width:18px;height:18px;color:#7C7C7C}
  .sv-linkrow:hover .sv-chev{color:var(--o)}

  .sv-signout{width:100%;height:44px;border:1px solid #ff5a3c;border-radius:8px;background:rgba(255,90,60,.08);
    color:#ff8a5c;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;
    font-size:15px;cursor:pointer}
  .sv-signout:hover{background:rgba(255,90,60,.16)}
  .sv-foot{text-align:center;color:#5a5a5a;font-size:12px;letter-spacing:1px;margin-top:18px}

  @media (max-width:420px){
    .sv-static{max-width:150px}
    .sv-input-sm{width:100px}
  }
`;
