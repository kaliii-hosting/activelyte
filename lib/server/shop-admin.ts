// Privileged shop + membership operations (server-only).
//
// Same pattern as user-admin: authorize the verified caller, stay within their
// organization, write audit logs. Membership lives in the shops/{shopId}/
// members subcollection (documents, not arrays).

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError } from "./http";
import { type Caller } from "./authorize";
import { writeAuditLog } from "./audit";
import { isAdminRole } from "@/lib/types/roles";
import type {
  Shop,
  ShopMember,
  ShopMemberRole,
  ShopStatus,
} from "@/lib/types/models";

type ShopRow = Pick<
  Shop,
  "id" | "organizationId" | "name" | "status" | "address" | "ownerUid" | "ownerName"
>;

function requireShopManager(caller: Caller): void {
  if (!isAdminRole(caller.role) || !caller.organizationId) {
    throw new HttpError(403, "You don't have permission to manage shops.");
  }
}

function toShopRow(id: string, v: FirebaseFirestore.DocumentData): ShopRow {
  return {
    id: v.id ?? id,
    organizationId: v.organizationId ?? "",
    name: v.name ?? "",
    status: (v.status ?? "active") as ShopStatus,
    address: v.address,
    ownerUid: v.ownerUid,
    ownerName: v.ownerName,
  };
}

async function loadShop(caller: Caller, shopId: string): Promise<ShopRow> {
  const doc = await adminDb().collection("shops").doc(shopId).get();
  if (!doc.exists) throw new HttpError(404, "Shop not found.");
  const row = toShopRow(doc.id, doc.data()!);
  if (caller.role !== "founder" && row.organizationId !== caller.organizationId) {
    throw new HttpError(403, "That shop is in a different organization.");
  }
  return row;
}

export async function listShops(caller: Caller): Promise<ShopRow[]> {
  requireShopManager(caller);
  const col = adminDb().collection("shops");
  const snap = await (caller.role === "founder"
    ? col.get()
    : col.where("organizationId", "==", caller.organizationId!).get());
  return snap.docs
    .map((d) => toShopRow(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createShop(
  caller: Caller,
  input: { name: string; address?: string },
): Promise<{ ok: true; id: string }> {
  requireShopManager(caller);
  const ref = adminDb().collection("shops").doc();
  await ref.set({
    id: ref.id,
    organizationId: caller.organizationId!,
    name: input.name,
    address: input.address ?? "",
    status: "active" as ShopStatus,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });
  await writeAuditLog({
    actor: caller,
    action: "shop.created",
    targetType: "shop",
    targetId: ref.id,
    details: { name: input.name },
  });
  return { ok: true, id: ref.id };
}

export async function updateShop(
  caller: Caller,
  input: { shopId: string; name?: string; address?: string; status?: ShopStatus },
): Promise<{ ok: true }> {
  requireShopManager(caller);
  const shop = await loadShop(caller, input.shopId);

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  };
  if (input.name !== undefined) patch.name = input.name;
  if (input.address !== undefined) patch.address = input.address;
  if (input.status !== undefined) patch.status = input.status;

  await adminDb().collection("shops").doc(shop.id).set(patch, { merge: true });
  await writeAuditLog({
    actor: caller,
    action: input.status !== undefined && Object.keys(patch).length === 3
      ? "shop.status_changed"
      : "shop.updated",
    targetType: "shop",
    targetId: shop.id,
    details: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  return { ok: true };
}

export async function getShopDetail(
  caller: Caller,
  shopId: string,
): Promise<{ shop: ShopRow; members: ShopMember[] }> {
  requireShopManager(caller);
  const shop = await loadShop(caller, shopId);
  const snap = await adminDb()
    .collection("shops")
    .doc(shopId)
    .collection("members")
    .get();
  const members = snap.docs.map((d) => d.data() as ShopMember);
  members.sort((a, b) => {
    // Owners first, then by name.
    if (a.memberRole !== b.memberRole) return a.memberRole === "shop_owner" ? -1 : 1;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });
  return { shop, members };
}

async function loadOrgUser(caller: Caller, uid: string) {
  const doc = await adminDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new HttpError(404, "User not found.");
  const v = doc.data()!;
  if (caller.role !== "founder" && v.organizationId !== caller.organizationId) {
    throw new HttpError(403, "That user is in a different organization.");
  }
  return {
    uid: v.uid ?? doc.id,
    displayName: (v.displayName as string) ?? "",
    email: (v.email as string) ?? "",
    organizationId: (v.organizationId as string) ?? "",
  };
}

export async function addShopMember(
  caller: Caller,
  input: { shopId: string; uid: string; memberRole: ShopMemberRole },
): Promise<{ ok: true }> {
  requireShopManager(caller);
  const shop = await loadShop(caller, input.shopId);
  const user = await loadOrgUser(caller, input.uid);

  const memberRef = adminDb()
    .collection("shops")
    .doc(shop.id)
    .collection("members")
    .doc(user.uid);
  await memberRef.set(
    {
      userId: user.uid,
      shopId: shop.id,
      organizationId: shop.organizationId,
      memberRole: input.memberRole,
      status: "active",
      displayName: user.displayName,
      email: user.email,
      addedAt: FieldValue.serverTimestamp(),
      addedBy: caller.uid,
    } satisfies ShopMember & { status: "active" },
    { merge: true },
  );

  // Keep the shop's denormalized owner in sync when assigning an owner.
  if (input.memberRole === "shop_owner") {
    await adminDb().collection("shops").doc(shop.id).set(
      {
        ownerUid: user.uid,
        ownerName: user.displayName,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      },
      { merge: true },
    );
  }

  await writeAuditLog({
    actor: caller,
    action: "shop.member_added",
    targetType: "shop",
    targetId: shop.id,
    details: { uid: user.uid, memberRole: input.memberRole },
  });
  return { ok: true };
}

export async function removeShopMember(
  caller: Caller,
  input: { shopId: string; uid: string },
): Promise<{ ok: true }> {
  requireShopManager(caller);
  const shop = await loadShop(caller, input.shopId);

  await adminDb()
    .collection("shops")
    .doc(shop.id)
    .collection("members")
    .doc(input.uid)
    .delete();

  // If we removed the current owner, clear the denormalized fields.
  if (shop.ownerUid === input.uid) {
    await adminDb().collection("shops").doc(shop.id).set(
      {
        ownerUid: FieldValue.delete(),
        ownerName: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      },
      { merge: true },
    );
  }

  await writeAuditLog({
    actor: caller,
    action: "shop.member_removed",
    targetType: "shop",
    targetId: shop.id,
    details: { uid: input.uid },
  });
  return { ok: true };
}
