// In-app notifications + FCM device-token registration.
//
// Notifications are created server-side (onMessageCreated + future triggers) and
// read here. Push token registration supports web (FCM + VAPID) and native
// (Capacitor) — web requires NEXT_PUBLIC_FIREBASE_VAPID_KEY to be set; without
// it, in-app notifications still work, just no browser push.

import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore, getFirebaseApp } from "@/lib/firebase/client";
import { vapidKey } from "@/lib/env";
import type { AppNotification } from "@/lib/types/models";

export function listenMyNotifications(
  uid: string,
  cb: (items: AppNotification[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firestore(), "notifications"), where("userId", "==", uid)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => d.data() as AppNotification)
          .sort((a, b) => ms(b.createdAt) - ms(a.createdAt)),
      ),
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(firestore(), "notifications", id), { read: true });
}

/** Persist an FCM/APNs device token under the user (used by web + native). */
export async function saveDeviceToken(
  uid: string,
  deviceId: string,
  token: string,
  platform: "web" | "ios" | "android",
): Promise<void> {
  await setDoc(
    doc(firestore(), "users", uid, "devices", deviceId),
    {
      deviceId,
      fcmToken: token,
      platform,
      lastSeenAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// Stable per-browser device id so repeat sign-ins update one device record.
function webDeviceId(): string {
  const KEY = "activelyte:deviceId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `web_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Register this device for push. Returns the token, or null if push isn't
 * available/permitted (in which case in-app notifications still work).
 * Web only here; native registration is wired via Capacitor (see lib/platform).
 */
export async function registerWebPush(uid: string): Promise<string | null> {
  if (typeof window === "undefined" || !vapidKey) return null;
  try {
    const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
    if (!(await isSupported())) return null;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return null;
    } else if (Notification.permission !== "granted") {
      return null;
    }
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    const deviceId = webDeviceId();
    await setDoc(
      doc(firestore(), "users", uid, "devices", deviceId),
      {
        deviceId,
        fcmToken: token,
        platform: "web",
        lastSeenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    return token;
  } catch {
    return null;
  }
}

function ms(v: unknown): number {
  return v && typeof (v as { toMillis?: () => number }).toMillis === "function"
    ? (v as { toMillis: () => number }).toMillis()
    : 0;
}
