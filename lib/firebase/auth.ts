// Client auth operations, wrapping the Firebase Auth SDK with typed helpers.
// UI components call these; they never touch the raw SDK. Errors are normalized
// to friendly messages via `authErrorMessage`.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { firebaseAuth } from "./client";
import type { Role } from "@/lib/types/roles";

export type SignedInUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  // From the ID token custom claims (undefined until a claim is set + token
  // refreshed). New sign-ups have no role until an admin/seed assigns one.
  role?: Role;
  organizationId?: string;
};

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string,
): Promise<SignedInUser> {
  const auth = firebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await sendEmailVerification(cred.user).catch(() => {
    /* non-fatal: user can re-request verification later */
  });
  return toSignedInUser(cred.user);
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<SignedInUser> {
  const auth = firebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return toSignedInUser(cred.user);
}

export async function logout(): Promise<void> {
  await fbSignOut(firebaseAuth());
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email);
}

export async function resendVerification(): Promise<void> {
  const user = firebaseAuth().currentUser;
  if (user) await sendEmailVerification(user);
}

// Fires on sign-in, sign-out, and whenever the ID token (and thus custom
// claims) refreshes. `forceRefresh` isn't used here — callers that just set a
// claim should call `refreshClaims()`.
export function watchAuth(
  cb: (user: SignedInUser | null) => void,
): Unsubscribe {
  return onIdTokenChanged(firebaseAuth(), async (user) => {
    cb(user ? await toSignedInUser(user) : null);
  });
}

// Force a token refresh so newly-set custom claims (role/org) become visible
// without requiring the user to sign out and back in.
export async function refreshClaims(): Promise<void> {
  const user = firebaseAuth().currentUser;
  if (user) await user.getIdToken(true);
}

// Current user's ID token, for authenticating calls to admin API routes.
export async function currentIdToken(): Promise<string | null> {
  const user = firebaseAuth().currentUser;
  return user ? user.getIdToken() : null;
}

async function toSignedInUser(user: User): Promise<SignedInUser> {
  const token = await user.getIdTokenResult();
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    role: token.claims.role as Role | undefined,
    organizationId: token.claims.organizationId as string | undefined,
  };
}

// Map Firebase error codes to messages safe to show a user.
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with that email already exists.";
    case "auth/weak-password":
      return "Password is too weak (use at least 8 characters).";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact an administrator.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
