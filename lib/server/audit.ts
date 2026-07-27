// Append-only audit logging for sensitive actions. Every privileged mutation
// writes one of these. auditLogs is write-once by design (enforced later in
// Security Rules, Phase 9); nothing updates or deletes entries.

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Caller } from "./authorize";

export type AuditAction =
  | "user.role_assigned"
  | "user.invited"
  | "user.status_changed"
  | "user.deleted"
  | "shop.created"
  | "shop.updated"
  | "shop.status_changed"
  | "shop.member_added"
  | "shop.member_removed"
  | "product.created"
  | "product.updated"
  | "product.codes_added"
  | "reward.created"
  | "reward.updated";

export async function writeAuditLog(params: {
  actor: Caller;
  action: AuditAction;
  targetType: "user" | "shop" | "product" | "reward";
  targetId: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const ref = adminDb().collection("auditLogs").doc();
  await ref.set({
    id: ref.id,
    organizationId: params.actor.organizationId ?? null,
    action: params.action,
    actorUid: params.actor.uid,
    actorRole: params.actor.role ?? null,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: FieldValue.serverTimestamp(),
  });
}
