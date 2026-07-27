// The Activelyte role model.
//
// `role` is stored as a Firebase Auth custom claim (broad authorization,
// available on the ID token everywhere) AND mirrored on the Firestore user
// profile (for querying/display). Custom claims are the source of truth that
// Security Rules and Cloud Functions trust; the UI reads them only to decide
// what to show. Hiding a control is never a substitute for a rule.

export const ROLES = [
  "founder",
  "super_admin",
  "admin",
  "shop_owner",
  "bartender",
  "client",
] as const;

export type Role = (typeof ROLES)[number];

// Descending authority. A higher rank implies every capability of the ranks
// below it, except where a capability is explicitly gated (e.g. critical
// reward policy is founder-only). Use `hasAtLeast` for hierarchy checks.
export const ROLE_RANK: Record<Role, number> = {
  founder: 60,
  super_admin: 50,
  admin: 40,
  shop_owner: 30,
  bartender: 20,
  client: 10,
};

export function hasAtLeast(role: Role | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Roles that can reach any administrative surface at all.
export const ADMIN_ROLES: readonly Role[] = [
  "founder",
  "super_admin",
  "admin",
];
export function isAdminRole(role: Role | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

// Owner tier — can manage admins (add/edit/disable/delete) and everyone below.
// Plain admins are admin-tier but NOT owner-tier, so they can't touch admins.
export const OWNER_ROLES: readonly Role[] = ["founder", "super_admin"];
export function isOwnerTier(role: Role | undefined): boolean {
  return !!role && OWNER_ROLES.includes(role);
}

// Shape of the Auth custom claims we set. Kept intentionally small — broad
// authorization only. Detailed profile/shop membership lives in Firestore.
export type AuthClaims = {
  role: Role;
  organizationId: string;
};

// UI labels. "Owner" = the top account (founder, seed). "Co-Owner" =
// super_admin, an owner-tier account the Owner can create; both manage admins.
// "Shop Manager" is shop_owner (renamed to free the word "owner" for the app
// owner). Role KEYS are unchanged — only display labels.
export const ROLE_LABELS: Record<Role, string> = {
  founder: "Owner",
  super_admin: "Co-Owner",
  admin: "Admin",
  shop_owner: "Shop Manager",
  bartender: "Bartender",
  client: "Client",
};
