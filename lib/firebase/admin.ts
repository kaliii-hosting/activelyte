// Server-only Firebase Admin singletons.
//
// The Admin SDK has FULL, rules-bypassing access to the project. It must NEVER
// reach the browser bundle. Import this only from server contexts: Route
// Handlers, Server Actions, standalone Node scripts, or Cloud Functions.
// A runtime guard below throws loudly if it is ever evaluated in a browser.

import {
  getApps,
  initializeApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/firebase/admin.ts was imported in the browser. The Admin SDK is " +
      "server-only and must never be bundled client-side.",
  );
}

function buildApp(): App {
  if (getApps().length) return getApps()[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys are stored with escaped newlines (\n) in a single-line env
  // value; restore the real newlines the credential parser expects.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let adminApp: App | undefined;
export function getAdminApp(): App {
  return (adminApp ??= buildApp());
}
export const adminAuth = (): Auth => getAuth(getAdminApp());
export const adminDb = (): Firestore => getFirestore(getAdminApp());
