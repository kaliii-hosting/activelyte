// Client-side Firebase singletons.
//
// Firebase must be initialized exactly once per browser session. The modular
// SDK's getAuth/getFirestore/etc. already return per-app singletons, so the
// only thing we guard here is initializeApp (getApps().length check). Import
// these accessors from Client Components only — never call them during SSR.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from "firebase/storage";
import {
  getDatabase,
  connectDatabaseEmulator,
  type Database,
} from "firebase/database";
import {
  getFunctions,
  connectFunctionsEmulator,
  type Functions,
} from "firebase/functions";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";
import {
  firebaseConfig,
  useEmulator,
  isFirebaseConfigured,
  appCheckSiteKey,
} from "@/lib/env";

let emulatorsConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Copy .env.example to .env.local and fill " +
        "in the NEXT_PUBLIC_FIREBASE_* values from the Firebase console.",
    );
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  maybeConnectEmulators(app);
  return app;
}

function maybeConnectEmulators(app: FirebaseApp) {
  if (!useEmulator || emulatorsConnected || typeof window === "undefined") return;
  emulatorsConnected = true;
  connectAuthEmulator(getAuth(app), "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFirestoreEmulator(getFirestore(app), "127.0.0.1", 8080);
  connectStorageEmulator(getStorage(app), "127.0.0.1", 9199);
  connectDatabaseEmulator(getDatabase(app), "127.0.0.1", 9000);
  connectFunctionsEmulator(getFunctions(app), "127.0.0.1", 5001);
}

// Initialize Firebase App Check once, client-side. No-op unless a reCAPTCHA v3
// site key is configured (NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY). Call once
// from a Client Component on mount.
let appCheckStarted = false;
export function initAppCheck(): void {
  if (appCheckStarted || typeof window === "undefined") return;
  if (!appCheckSiteKey || !isFirebaseConfigured) return;
  appCheckStarted = true;
  try {
    initializeAppCheck(getFirebaseApp(), {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    /* already initialized or unsupported — safe to ignore */
  }
}

export const firebaseAuth = (): Auth => getAuth(getFirebaseApp());
export const firestore = (): Firestore => getFirestore(getFirebaseApp());
export const firebaseStorage = (): FirebaseStorage =>
  getStorage(getFirebaseApp());
// Realtime Database is used ONLY for ephemeral presence + typing state.
export const rtdb = (): Database => getDatabase(getFirebaseApp());
// Callable Cloud Functions (default region us-central1).
export const functionsClient = (): Functions => getFunctions(getFirebaseApp());
