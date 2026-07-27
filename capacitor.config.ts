import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor packaging for iOS + Android. Building the native apps requires
// Xcode (iOS) / Android Studio (Android) — see help.md §11 (Phase 8).
//
// Two shipping options:
//  1. Static bundle: `next build` with output:'export' → webDir 'out', then
//     `npx cap sync`. Requires moving the Node-runtime admin API routes to
//     callable Cloud Functions first (they can't be statically exported).
//  2. Hosted app: uncomment `server.url` to load a deployed build in the native
//     shell (no static export needed). Simplest given the current API routes.
const config: CapacitorConfig = {
  appId: "app.activelyte",
  appName: "Activelyte",
  webDir: "out",
  // server: { url: "https://<your-deployment>", cleartext: false },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
