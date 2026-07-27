"use client";

// Admin settings: organization + feature configuration, stored per section in
// appSettings. Admin-tier only (Route Handler re-checks). Fields are typed by
// the SECTIONS definition below.

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

type Field = { key: string; label: string; type: "text" | "number" | "bool" };
type Section = { id: string; title: string; fields: Field[] };

const SECTIONS: Section[] = [
  { id: "general", title: "General", fields: [
    { key: "orgName", label: "Organization name", type: "text" },
    { key: "supportEmail", label: "Support email", type: "text" },
    { key: "timezone", label: "Time zone", type: "text" },
  ]},
  { id: "messaging", title: "Messaging", fields: [
    { key: "allowGroups", label: "Allow group chats", type: "bool" },
    { key: "allowBroadcasts", label: "Allow private broadcasts", type: "bool" },
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

type Values = Record<string, Record<string, string | number | boolean>>;

export function SettingsManager() {
  const [values, setValues] = useState<Values>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ k: "ok" | "err"; t: string } | null>(null);

  const flash = (k: "ok" | "err", t: string) => { setMsg({ k, t }); setTimeout(() => setMsg(null), 3000); };

  useEffect(() => {
    apiFetch<{ settings: Values }>("/api/admin/settings")
      .then((d) => setValues(d.settings ?? {}))
      .catch((e) => flash("err", e instanceof Error ? e.message : "Failed to load."));
  }, []);

  const set = (section: string, key: string, v: string | number | boolean) =>
    setValues((s) => ({ ...s, [section]: { ...(s[section] ?? {}), [key]: v } }));

  const save = async (section: Section) => {
    setSaving(section.id);
    try {
      await apiFetch("/api/admin/settings", { method: "POST", body: {
        section: section.id, values: values[section.id] ?? {},
      }});
      flash("ok", `${section.title} saved.`);
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(null); }
  };

  return (
    <section className="st">
      <style>{css}</style>
      <div className="st-head"><h1>Settings</h1><p>Organization & feature configuration.</p></div>
      {msg && <div className={`st-alert ${msg.k}`}>{msg.t}</div>}

      {SECTIONS.map((sec) => (
        <div key={sec.id} className="st-card">
          <div className="st-card-title">{sec.title}</div>
          {sec.fields.map((f) => {
            const cur = values[sec.id]?.[f.key];
            return (
              <label key={f.key} className="st-field">
                <span className="st-label">{f.label}</span>
                {f.type === "bool" ? (
                  <input type="checkbox" checked={!!cur} onChange={(e) => set(sec.id, f.key, e.target.checked)} />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    value={cur === undefined ? "" : String(cur)}
                    onChange={(e) => set(sec.id, f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </label>
            );
          })}
          <button className="st-save" disabled={saving === sec.id} onClick={() => save(sec)}>
            {saving === sec.id ? "Saving…" : "Save"}
          </button>
        </div>
      ))}
    </section>
  );
}

const css = `
  .st{max-width:640px;margin:0 auto;padding:20px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .st-head h1{font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .st-head p{color:#8C8C8C;font-size:14px;margin:4px 0 14px}
  .st-alert{margin:8px 0;padding:10px 12px;border-radius:5px;font-size:13px;border:1px solid}
  .st-alert.ok{background:rgba(31,138,104,.12);border-color:rgba(31,138,104,.5);color:#61d3a8}
  .st-alert.err{background:rgba(255,90,60,.08);border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .st-card{border:1.5px solid #2a2a2a;border-radius:8px;padding:16px;margin-bottom:14px;background:#0a0a0a}
  .st-card-title{font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F0842E;margin-bottom:12px}
  .st-field{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .st-label{font-size:14px;color:#cfcfcf}
  .st-field input[type=text],.st-field input[type=number]{width:180px;height:36px;padding:0 10px;background:#0c0c0c;
    border:1.5px solid #333;border-radius:5px;color:#F2F2F2;font-family:inherit;font-size:14px;outline:none}
  .st-field input:focus{border-color:#F5852A}
  .st-field input[type=checkbox]{width:18px;height:18px;accent-color:#F5852A}
  .st-save{margin-top:12px;height:38px;padding:0 20px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .st-save:disabled{opacity:.5}
  /* narrow phones: stack label above input so nothing overflows */
  @media (max-width:480px){
    .st-field{flex-direction:column;align-items:stretch;gap:6px}
    .st-field input[type=text],.st-field input[type=number]{width:100%}
    .st-field input[type=checkbox]{align-self:flex-start}
  }
`;
