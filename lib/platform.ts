// Platform abstraction for the web ↔ Capacitor (iOS/Android) split.
// On the web these are inert; inside a Capacitor shell they use native plugins
// (push, camera barcode scanning). All imports are dynamic so the web bundle
// never pulls native code.

import { Capacitor } from "@capacitor/core";

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platformName = (): "web" | "ios" | "android" =>
  Capacitor.getPlatform() as "web" | "ios" | "android";

/**
 * Register for native push (iOS/APNs, Android/FCM). Calls `onToken` with the
 * device token to persist. No-op on web (use registerWebPush there instead).
 */
export async function registerNativePush(
  onToken: (token: string) => void,
): Promise<void> {
  if (!isNative()) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
  await PushNotifications.addListener("registration", (t) => onToken(t.value));
}

/** Native camera barcode/QR scan (single result). Returns null on web. */
export async function scanNative(): Promise<string | null> {
  if (!isNative()) return null;
  const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
  const { barcodes } = await BarcodeScanner.scan();
  return barcodes[0]?.rawValue ?? null;
}
