// Client-visible Firebase configuration.
//
// These NEXT_PUBLIC_* values are NOT secrets — they identify the Firebase
// project and are meant to ship in the browser bundle. All real security is
// enforced server-side by Firebase Security Rules, App Check, and Cloud
// Functions (see SECURITY_AND_TESTING.md). Never put a service-account key or
// any FIREBASE_PRIVATE_KEY here — those live in `lib/firebase/admin.ts` and are
// read only on the server.

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
};

export const firebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined,
};

export const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";
export const appCheckSiteKey =
  process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY ?? "";
export const useEmulator =
  process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "true";

// True only when the minimum client config is present. Lets UI render a clear
// "not configured yet" state instead of throwing an opaque Firebase error.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);
