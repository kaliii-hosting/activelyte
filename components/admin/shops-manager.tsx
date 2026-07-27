"use client";

// Founder/admin shops management: create shops, edit status, and manage
// membership (owner + bartenders) via the members subcollection. Styled with
// the Activelyte tokens. All mutations go through the org-scoped admin API.

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/types/roles";
import type { ShopMember, ShopMemberRole, ShopStatus } from "@/lib/types/models";

type ShopRow = {
  id: string;
  name: string;
  status: ShopStatus;
  address?: string;
  ownerUid?: string;
  ownerName?: string;
};
type OrgUser = { uid: string; displayName: string; email: string; role: string };

export function ShopsManager() {
  const [shops, setShops] = useState<ShopRow[] | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadShops = useCallback(async () => {
    setError(null);
    try {
      const { shops } = await apiFetch<{ shops: ShopRow[] }>("/api/admin/shops");
      setShops(shops);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shops.");
      setShops([]);
    }
  }, []);

  useEffect(() => {
    void loadShops();
    void apiFetch<{ users: OrgUser[] }>("/api/admin/users")
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]));
  }, [loadShops]);

  const flash = (msg: string) => {
    setNotice(msg);
    setError(null);
  };

  return (
    <section className="sm">
      <style>{css}</style>
      <div className="sm-head">
        <h1>Shops</h1>
        <p>Create shops and manage owners and bartenders.</p>
      </div>

      {error && <div className="sm-alert error">{error}</div>}
      {notice && <div className="sm-alert ok">{notice}</div>}

      <CreateShop onCreated={(msg) => { flash(msg); void loadShops(); }} onError={setError} />

      {shops === null ? (
        <div className="sm-empty">Loading shops…</div>
      ) : shops.length === 0 ? (
        <div className="sm-empty">No shops yet. Create one above.</div>
      ) : (
        <ul className="sm-list">
          {shops.map((s) => (
            <li key={s.id}>
              <button
                className={`sm-shop${selected === s.id ? " open" : ""}`}
                onClick={() => setSelected((cur) => (cur === s.id ? null : s.id))}
              >
                <span className="sm-shop-main">
                  <span className="sm-shop-name">{s.name}</span>
                  <span className="sm-shop-sub">
                    {s.ownerName ? `Owner: ${s.ownerName}` : "No owner"}
                    {s.address ? ` · ${s.address}` : ""}
                  </span>
                </span>
                <span className={`sm-status ${s.status}`}>{s.status}</span>
              </button>
              {selected === s.id && (
                <ShopDetail
                  shopId={s.id}
                  users={users}
                  onChanged={(msg) => { flash(msg); void loadShops(); }}
                  onError={setError}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CreateShop({
  onCreated,
  onError,
}: {
  onCreated: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      await apiFetch("/api/admin/shops", {
        method: "POST",
        body: { name: name.trim(), address: address.trim() || undefined },
      });
      onCreated(`Created shop "${name.trim()}".`);
      setName("");
      setAddress("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create shop.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sm-create" onSubmit={submit}>
      <input
        type="text"
        placeholder="Shop name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Address (optional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <button type="submit" disabled={busy || name.trim().length < 2}>
        {busy ? "Creating…" : "Create shop"}
      </button>
    </form>
  );
}

function ShopDetail({
  shopId,
  users,
  onChanged,
  onError,
}: {
  shopId: string;
  users: OrgUser[];
  onChanged: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [detail, setDetail] = useState<{ shop: ShopRow; members: ShopMember[] } | null>(null);
  const [addUid, setAddUid] = useState("");
  const [addRole, setAddRole] = useState<ShopMemberRole>("bartender");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ shop: ShopRow; members: ShopMember[] }>(
        `/api/admin/shops/detail?shopId=${encodeURIComponent(shopId)}`,
      );
      setDetail(d);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to load shop.");
    }
  }, [shopId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberUids = new Set(detail?.members.map((m) => m.userId));
  const addable = users.filter((u) => !memberUids.has(u.uid));

  const toggleStatus = async () => {
    if (!detail) return;
    const status: ShopStatus = detail.shop.status === "active" ? "inactive" : "active";
    setBusy(true);
    try {
      await apiFetch("/api/admin/shops/update", { method: "POST", body: { shopId, status } });
      onChanged(`Shop ${status === "inactive" ? "deactivated" : "activated"}.`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    if (!addUid) return;
    setBusy(true);
    try {
      await apiFetch("/api/admin/shops/members", {
        method: "POST",
        body: { shopId, uid: addUid, memberRole: addRole },
      });
      onChanged("Member added.");
      setAddUid("");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add member.");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (uid: string) => {
    setBusy(true);
    try {
      await apiFetch("/api/admin/shops/members/remove", { method: "POST", body: { shopId, uid } });
      onChanged("Member removed.");
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setBusy(false);
    }
  };

  if (!detail) return <div className="sm-detail sm-empty">Loading…</div>;

  return (
    <div className="sm-detail">
      <div className="sm-detail-bar">
        <button className="sm-toggle" disabled={busy} onClick={toggleStatus}>
          {detail.shop.status === "active" ? "Deactivate" : "Activate"}
        </button>
      </div>

      <div className="sm-members-title">Members ({detail.members.length})</div>
      {detail.members.length === 0 ? (
        <div className="sm-empty small">No members yet.</div>
      ) : (
        <ul className="sm-members">
          {detail.members.map((m) => (
            <li key={m.userId}>
              <span className="sm-mrole">{m.memberRole === "shop_owner" ? "Owner" : "Bartender"}</span>
              <span className="sm-mname">{m.displayName || m.email}</span>
              <button className="sm-remove" disabled={busy} onClick={() => removeMember(m.userId)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="sm-addmember">
        <select value={addUid} onChange={(e) => setAddUid(e.target.value)} disabled={addable.length === 0}>
          <option value="">
            {addable.length === 0 ? "All org users are members" : "Select a user…"}
          </option>
          {addable.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.displayName || u.email} ({ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role})
            </option>
          ))}
        </select>
        <select value={addRole} onChange={(e) => setAddRole(e.target.value as ShopMemberRole)}>
          <option value="bartender">Bartender</option>
          <option value="shop_owner">Owner</option>
        </select>
        <button disabled={busy || !addUid} onClick={addMember}>
          Add
        </button>
      </div>
    </div>
  );
}

const css = `
  .sm{max-width:760px;margin:0 auto;padding:20px 16px 40px;font-family:'Saira',sans-serif;color:#F2F2F2}
  .sm-head h1{font-size:26px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0}
  .sm-head p{color:#8C8C8C;font-size:14px;margin:4px 0 18px}
  .sm-alert{margin:0 0 14px;padding:10px 12px;border-radius:5px;font-size:13px;border:1px solid;line-height:1.4}
  .sm-alert.error{background:rgba(255,90,60,.08);border-color:rgba(255,90,60,.4);color:#ff9c7a}
  .sm-alert.ok{background:rgba(31,138,104,.12);border-color:rgba(31,138,104,.5);color:#61d3a8}

  .sm-create{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
  .sm-create input{height:42px;padding:0 12px;background:#0c0c0c;border:1.5px solid #333;border-radius:5px;
    color:#F2F2F2;font-family:inherit;font-size:14px;outline:none;flex:1 1 160px}
  .sm-create input:focus{border-color:#F5852A}
  .sm-create button{height:42px;padding:0 18px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .sm-create button:disabled{opacity:.5}

  .sm-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
  .sm-shop{width:100%;display:flex;align-items:center;gap:12px;padding:14px;background:#0b0b0b;
    border:1.5px solid #2a2a2a;border-radius:6px;cursor:pointer;text-align:left;color:inherit;font-family:inherit}
  .sm-shop:hover{border-color:#4A4A4A}
  .sm-shop.open{border-color:#F5852A;background:linear-gradient(90deg,rgba(90,46,8,.5),rgba(24,14,5,.3)),#0b0b0b}
  .sm-shop-main{flex:1;min-width:0}
  .sm-shop-name{display:block;font-size:17px;font-weight:600;letter-spacing:.5px}
  .sm-shop-sub{display:block;font-size:12px;color:#7C7C7C;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sm-status{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:3px;flex:none}
  .sm-status.active{color:#61d3a8;border:1px solid rgba(31,138,104,.5)}
  .sm-status.inactive{color:#8C8C8C;border:1px solid #4A4A4A}

  .sm-detail{padding:14px;border:1.5px solid #2a2a2a;border-top:none;border-radius:0 0 6px 6px;background:#080808;margin-top:-8px}
  .sm-detail-bar{display:flex;justify-content:flex-end;margin-bottom:10px}
  .sm-toggle{height:34px;padding:0 14px;background:none;border:1.5px solid #4A4A4A;border-radius:5px;color:#cfcfcf;
    font-family:inherit;font-size:12px;font-weight:600;letter-spacing:1px;cursor:pointer}
  .sm-toggle:hover{border-color:#F5852A;color:#F0842E}
  .sm-members-title{font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C8C8C;margin-bottom:8px}
  .sm-members{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column}
  .sm-members li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)}
  .sm-mrole{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#F0842E;
    border:1px solid rgba(245,133,42,.4);border-radius:3px;padding:2px 6px;flex:none;min-width:70px;text-align:center}
  .sm-mname{flex:1;font-size:14px}
  .sm-remove{background:none;border:none;color:#8C8C8C;font-family:inherit;font-size:12px;cursor:pointer}
  .sm-remove:hover{color:#ff9c7a}

  .sm-addmember{display:flex;flex-wrap:wrap;gap:8px}
  .sm-addmember select{height:38px;padding:0 10px;background:#0c0c0c;border:1.5px solid #333;border-radius:5px;
    color:#F2F2F2;font-family:inherit;font-size:13px;outline:none}
  .sm-addmember select:first-child{flex:1 1 180px}
  .sm-addmember select:focus{border-color:#F5852A}
  .sm-addmember button{height:38px;padding:0 16px;border:none;border-radius:5px;background:#F5852A;color:#1a1103;
    font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
  .sm-addmember button:disabled{opacity:.5}

  .sm-empty{padding:24px;text-align:center;color:#7C7C7C;font-size:14px}
  .sm-empty.small{padding:12px}
`;
