// Pure authorization policy — no Firebase imports, safe on client AND server.
//
// These functions are the single source of truth for "who may do what" around
// roles. The server enforces them for real; the client imports the same
// functions only to decide what to show. Keeping them pure means they are
// trivially unit-testable and identical in both places.

import { ROLE_RANK, ROLES, type Role } from "./types/roles";

// Only admin-tier roles can manage other users at all.
const CAN_MANAGE_MIN_RANK = ROLE_RANK.admin;

/**
 * Roles a caller may grant. Rule: strictly below the caller's own rank, and
 * only if the caller is admin-tier. This structurally prevents privilege
 * escalation — no one can mint a peer or a superior. Founder is never
 * assignable through the app (seed-only).
 */
export function assignableRoles(callerRole: Role | undefined): Role[] {
  if (!callerRole || ROLE_RANK[callerRole] < CAN_MANAGE_MIN_RANK) return [];
  const callerRank = ROLE_RANK[callerRole];
  return ROLES.filter(
    (r) => r !== "founder" && ROLE_RANK[r] < callerRank,
  );
}

/**
 * Whether `callerRole` may act on a user who currently holds `targetRole`.
 * Callers can only touch users strictly below their own rank (never peers,
 * superiors, or themselves-by-rank), and must be admin-tier.
 */
export function canManageUser(
  callerRole: Role | undefined,
  targetRole: Role | undefined,
): boolean {
  if (!callerRole || ROLE_RANK[callerRole] < CAN_MANAGE_MIN_RANK) return false;
  const targetRank = targetRole ? ROLE_RANK[targetRole] : 0;
  return ROLE_RANK[callerRole] > targetRank;
}

/**
 * Full check for a role change: caller may manage the target's *current* role
 * AND may grant the *new* role.
 */
export function canAssignRole(
  callerRole: Role | undefined,
  targetCurrentRole: Role | undefined,
  newRole: Role,
): boolean {
  return (
    canManageUser(callerRole, targetCurrentRole) &&
    assignableRoles(callerRole).includes(newRole)
  );
}
