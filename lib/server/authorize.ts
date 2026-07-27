// Server-side caller identification. Verifies the Firebase ID token sent in the
// Authorization: Bearer <token> header (the app's stateless auth scheme) and
// returns the trusted caller identity from the token's custom claims.
//
// This is the real authorization boundary for admin Route Handlers — it trusts
// only the cryptographically-verified token, never client-supplied body fields.

import { adminAuth } from "@/lib/firebase/admin";
import { HttpError } from "./http";
import { hasAtLeast, type Role } from "@/lib/types/roles";

export type Caller = {
  uid: string;
  email?: string;
  role?: Role;
  organizationId?: string;
};

export async function requireCaller(req: Request): Promise<Caller> {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) throw new HttpError(401, "Missing authentication token.");

  let decoded;
  try {
    // checkRevoked=true so a disabled/revoked user can't keep acting.
    decoded = await adminAuth().verifyIdToken(match[1], true);
  } catch {
    throw new HttpError(401, "Invalid or expired session. Please sign in again.");
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    role: decoded.role as Role | undefined,
    organizationId: decoded.organizationId as string | undefined,
  };
}

// Require the caller to hold at least `min`. Throws 403 otherwise.
export function requireRole(caller: Caller, min: Role): void {
  if (!hasAtLeast(caller.role, min)) {
    throw new HttpError(403, "You don't have permission to do that.");
  }
}
