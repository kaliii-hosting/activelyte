// Privileged product + reward administration (server-only, Admin SDK).
// Same pattern as shop-admin: admin-tier, org-scoped, audited. Points logic
// lives in Cloud Functions, not here — this only manages catalog definitions.

import { createHash } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError } from "./http";
import { type Caller } from "./authorize";
import { writeAuditLog } from "./audit";
import { isAdminRole, type Role } from "@/lib/types/roles";

function requireAdmin(caller: Caller): void {
  if (!isAdminRole(caller.role) || !caller.organizationId) {
    throw new HttpError(403, "You don't have permission to manage the catalog.");
  }
}
const orgFilter = (caller: Caller) =>
  caller.role === "founder" ? null : caller.organizationId!;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---- Products --------------------------------------------------------------

export async function listProducts(caller: Caller) {
  requireAdmin(caller);
  const col = adminDb().collection("products");
  const org = orgFilter(caller);
  const snap = await (org ? col.where("organizationId", "==", org).get() : col.get());
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) =>
      String((a as { name?: string }).name ?? "").localeCompare(
        String((b as { name?: string }).name ?? ""),
      ),
    );
}

export async function createProduct(
  caller: Caller,
  input: {
    name: string; description?: string; sku?: string; barcode?: string;
    rewardPoints: number; perUserDailyLimit?: number;
  },
) {
  requireAdmin(caller);
  const ref = adminDb().collection("products").doc();
  await ref.set({
    id: ref.id,
    organizationId: caller.organizationId!,
    name: input.name,
    description: input.description ?? "",
    sku: input.sku ?? "",
    barcode: input.barcode ?? "",
    rewardPoints: input.rewardPoints,
    ...(input.perUserDailyLimit ? { perUserDailyLimit: input.perUserDailyLimit } : {}),
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });
  await writeAuditLog({ actor: caller, action: "product.created", targetType: "product", targetId: ref.id, details: { name: input.name } });
  return { ok: true as const, id: ref.id };
}

export async function updateProduct(
  caller: Caller,
  input: Record<string, unknown> & { productId: string },
) {
  requireAdmin(caller);
  const ref = adminDb().collection("products").doc(input.productId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Product not found.");
  if (caller.role !== "founder" && snap.data()!.organizationId !== caller.organizationId) {
    throw new HttpError(403, "Different organization.");
  }
  const { productId, ...rest } = input;
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  for (const k of ["name", "description", "barcode", "rewardPoints", "perUserDailyLimit", "status"]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  await ref.set(patch, { merge: true });
  await writeAuditLog({ actor: caller, action: "product.updated", targetType: "product", targetId: productId, details: patch });
  return { ok: true as const };
}

/** Register unique serialized reward codes for a product (stored hashed). */
export async function addProductCodes(
  caller: Caller,
  input: { productId: string; points: number; codes: string[] },
) {
  requireAdmin(caller);
  const prod = await adminDb().collection("products").doc(input.productId).get();
  if (!prod.exists) throw new HttpError(404, "Product not found.");
  if (caller.role !== "founder" && prod.data()!.organizationId !== caller.organizationId) {
    throw new HttpError(403, "Different organization.");
  }
  const db = adminDb();
  let created = 0;
  // Chunk into batches of 400 writes.
  const unique = [...new Set(input.codes.map((c) => c.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 400) {
    const batch = db.batch();
    for (const code of unique.slice(i, i + 400)) {
      const id = sha256(code);
      batch.set(db.collection("productCodes").doc(id), {
        id,
        organizationId: caller.organizationId!,
        productId: input.productId,
        points: input.points,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        createdBy: caller.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      }, { merge: true });
      created++;
    }
    await batch.commit();
  }
  await writeAuditLog({ actor: caller, action: "product.codes_added", targetType: "product", targetId: input.productId, details: { count: created } });
  return { ok: true as const, created };
}

// ---- Rewards ---------------------------------------------------------------

export async function listRewards(caller: Caller) {
  requireAdmin(caller);
  const col = adminDb().collection("rewards");
  const org = orgFilter(caller);
  const snap = await (org ? col.where("organizationId", "==", org).get() : col.get());
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}

export async function createReward(
  caller: Caller,
  input: {
    title: string; description?: string; pointsRequired: number;
    eligibleRoles?: Role[]; inventory?: number; requiresApproval?: boolean;
  },
) {
  requireAdmin(caller);
  const ref = adminDb().collection("rewards").doc();
  await ref.set({
    id: ref.id,
    organizationId: caller.organizationId!,
    title: input.title,
    description: input.description ?? "",
    pointsRequired: input.pointsRequired,
    ...(input.eligibleRoles?.length ? { eligibleRoles: input.eligibleRoles } : {}),
    ...(input.inventory !== undefined ? { inventory: input.inventory } : {}),
    requiresApproval: input.requiresApproval ?? false,
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: caller.uid,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: caller.uid,
  });
  await writeAuditLog({ actor: caller, action: "reward.created", targetType: "reward", targetId: ref.id, details: { title: input.title } });
  return { ok: true as const, id: ref.id };
}

export async function updateReward(
  caller: Caller,
  input: Record<string, unknown> & { rewardId: string },
) {
  requireAdmin(caller);
  const ref = adminDb().collection("rewards").doc(input.rewardId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Reward not found.");
  if (caller.role !== "founder" && snap.data()!.organizationId !== caller.organizationId) {
    throw new HttpError(403, "Different organization.");
  }
  const { rewardId, ...rest } = input;
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp(), updatedBy: caller.uid };
  for (const k of ["title", "description", "pointsRequired", "inventory", "requiresApproval", "active"]) {
    if (rest[k] !== undefined) patch[k] = rest[k];
  }
  await ref.set(patch, { merge: true });
  await writeAuditLog({ actor: caller, action: "reward.updated", targetType: "reward", targetId: rewardId, details: patch });
  return { ok: true as const };
}

/** Admin view of redemptions (optionally only pending). */
export async function listRedemptions(caller: Caller, pendingOnly: boolean) {
  requireAdmin(caller);
  let q = adminDb()
    .collection("redemptions")
    .where("organizationId", "==", caller.organizationId!);
  if (pendingOnly) q = q.where("status", "==", "pending");
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
}
