// Privileged user-administration operations (server-only).
//
// These contain the real business rules for managing users: role assignment,
// invitations, enable/disable. They are transport-agnostic — today they're
// called from Next Route Handlers; in Phase 4/9 the same functions can be
// wrapped in callable Cloud Functions with no logic change.
//
// Every op re-checks authorization against the VERIFIED caller (never trusts
// client input for identity), enforces the no-escalation policy from
// lib/authz.ts, keeps actions within the caller's organization, and writes an
// audit log.

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError } from "./http";
import { type Caller } from "./authorize";
import { writeAuditLog } from "./audit";
import { canAssignRole, canManageUser } from "@/lib/authz";
import { isAdminRole, type Role } from "@/lib/types/roles";
import type { UserProfile, UserStatus } from "@/lib/types/models";

type ProfileRow = Pick<
  UserProfile,
  "uid" | "email" | "displayName" | "role" | "status" | "organizationId"
> & { photoURL?: string };

function requireAdminTier(caller: Caller): void {
  if (!isAdminRole(caller.role) || !caller.organizationId) {
    throw new HttpError(403, "You don't have permission to manage users.");
  }
}

// Founder operates globally; everyone else is confined to their own org.
function orgScopeFilter(caller: Caller) {
  return caller.role === "founder" ? null : caller.organizationId!;
}

/** List users the caller may see (their organization; founder sees all). */
export async function listUsers(caller: Caller): Promise<ProfileRow[]> {
  requireAdminTier(caller);
  const col = adminDb().collection("users");
  const org = orgScopeFilter(caller);
  const snap = await (org
    ? col.where("organizationId", "==", org).get()
    : col.get());
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        uid: v.uid ?? d.id,
        email: v.email ?? "",
        displayName: v.displayName ?? "",
        role: v.role as Role,
        status: (v.status ?? "active") as UserStatus,
        organizationId: v.organizationId ?? "",
        photoURL: v.photoURL,
      } satisfies ProfileRow;
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

async function loadTarget(uid: string): Promise<ProfileRow> {
  const doc = await adminDb().collection("users").doc(uid).get();
  if (!doc.exists) throw new HttpError(404, "User not found.");
  const v = doc.data()!;
  return {
    uid: v.uid ?? doc.id,
    email: v.email ?? "",
    displayName: v.displayName ?? "",
    role: v.role as Role,
    status: (v.status ?? "active") as UserStatus,
    organizationId: v.organizationId ?? "",
    photoURL: v.photoURL,
  };
}

function assertSameOrgOrFounder(caller: Caller, target: ProfileRow): void {
  if (caller.role !== "founder" && target.organizationId !== caller.organizationId) {
    throw new HttpError(403, "That user is in a different organization.");
  }
}

/** Change a user's role. Enforces no-escalation + org scope + audit. */
export async function assignRole(
  caller: Caller,
  input: { uid: string; role: Role },
): Promise<{ ok: true }> {
  requireAdminTier(caller);
  if (input.uid === caller.uid) {
    throw new HttpError(400, "You can't change your own role.");
  }
  const target = await loadTarget(input.uid);
  assertSameOrgOrFounder(caller, target);

  if (!canAssignRole(caller.role, target.role, input.role)) {
    throw new HttpError(
      403,
      `You can't assign the ${input.role} role to this user.`,
    );
  }

  // Preserve the target's org; roles never move a user between orgs here.
  const organizationId = target.organizationId || caller.organizationId!;
  await adminAuth().setCustomUserClaims(input.uid, {
    role: input.role,
    organizationId,
  });
  await adminDb()
    .collection("users")
    .doc(input.uid)
    .set(
      {
        role: input.role,
        organizationId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      },
      { merge: true },
    );
  await writeAuditLog({
    actor: caller,
    action: "user.role_assigned",
    targetType: "user",
    targetId: input.uid,
    details: { from: target.role, to: input.role },
  });
  return { ok: true };
}

/**
 * Invite a user by email: create (or reuse) the Auth account, assign the role,
 * write an "invited" profile, and return a password-setup link to send them.
 */
export async function inviteUser(
  caller: Caller,
  input: { email: string; displayName: string; role: Role },
): Promise<{ ok: true; uid: string; setupLink: string }> {
  requireAdminTier(caller);
  if (!canAssignRole(caller.role, undefined, input.role)) {
    throw new HttpError(403, `You can't grant the ${input.role} role.`);
  }
  const organizationId = caller.organizationId!;

  // Find or create the Auth user.
  let uid: string;
  let isNew = false;
  try {
    const existing = await adminAuth().getUserByEmail(input.email);
    uid = existing.uid;
    // Guard against hijacking a user who already belongs to another org.
    const prior = await adminDb().collection("users").doc(uid).get();
    const priorOrg = prior.exists ? (prior.data()!.organizationId as string) : null;
    if (priorOrg && priorOrg !== organizationId && caller.role !== "founder") {
      throw new HttpError(409, "That email already belongs to another organization.");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const created = await adminAuth().createUser({
      email: input.email,
      displayName: input.displayName,
      emailVerified: false,
    });
    uid = created.uid;
    isNew = true;
  }

  await adminAuth().setCustomUserClaims(uid, { role: input.role, organizationId });
  await adminDb()
    .collection("users")
    .doc(uid)
    .set(
      {
        uid,
        organizationId,
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        status: "invited" as UserStatus,
        emailVerified: false,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
        ...(isNew
          ? { createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid }
          : {}),
      },
      { merge: true },
    );

  const setupLink = await adminAuth().generatePasswordResetLink(input.email);
  await writeAuditLog({
    actor: caller,
    action: "user.invited",
    targetType: "user",
    targetId: uid,
    details: { email: input.email, role: input.role, isNew },
  });
  return { ok: true, uid, setupLink };
}

/**
 * Permanently delete a user (Auth account + profile). Owner-tier can delete
 * admins; admins can delete only non-admins. The founder/Owner is never
 * deletable, and you can't delete yourself.
 */
export async function deleteUserAccount(
  caller: Caller,
  input: { uid: string },
): Promise<{ ok: true }> {
  requireAdminTier(caller);
  if (input.uid === caller.uid) {
    throw new HttpError(400, "You can't delete your own account.");
  }
  const target = await loadTarget(input.uid);
  assertSameOrgOrFounder(caller, target);
  if (target.role === "founder") {
    throw new HttpError(403, "The Owner account can't be deleted.");
  }
  if (!canManageUser(caller.role, target.role)) {
    throw new HttpError(403, "You don't have permission to delete this user.");
  }

  await adminAuth().deleteUser(input.uid).catch(() => {
    /* auth user may already be gone; still remove the profile */
  });
  await adminDb().collection("users").doc(input.uid).delete();
  await writeAuditLog({
    actor: caller,
    action: "user.deleted",
    targetType: "user",
    targetId: input.uid,
    details: { email: target.email, role: target.role },
  });
  return { ok: true };
}

/** Enable or disable a user account (blocks/allows sign-in). */
export async function setUserStatus(
  caller: Caller,
  input: { uid: string; status: "active" | "disabled" },
): Promise<{ ok: true }> {
  requireAdminTier(caller);
  if (input.uid === caller.uid) {
    throw new HttpError(400, "You can't change your own status.");
  }
  const target = await loadTarget(input.uid);
  assertSameOrgOrFounder(caller, target);
  if (!canManageUser(caller.role, target.role)) {
    throw new HttpError(403, "You can't manage this user.");
  }

  const disabled = input.status === "disabled";
  await adminAuth().updateUser(input.uid, { disabled });
  await adminDb()
    .collection("users")
    .doc(input.uid)
    .set(
      {
        status: input.status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      },
      { merge: true },
    );
  await writeAuditLog({
    actor: caller,
    action: "user.status_changed",
    targetType: "user",
    targetId: input.uid,
    details: { status: input.status },
  });
  return { ok: true };
}
