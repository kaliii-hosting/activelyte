/* Firebase Cloud Messaging service worker — handles background push.
   Config here is the PUBLIC web config (safe to expose). Keep in sync with
   .env.local NEXT_PUBLIC_FIREBASE_*. */
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: "AIzaSyCxHG-0JOIny6TTKwtDHfv-4FsKz4gVWW8",
  authDomain: "activelyte.firebaseapp.com",
  projectId: "activelyte",
  storageBucket: "activelyte.firebasestorage.app",
  messagingSenderId: "494688846882",
  appId: "1:494688846882:web:350c13e46d122535a2367b",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Activelyte";
  const body = payload.notification?.body || "";
  const conversationId = payload.data?.conversationId;
  self.registration.showNotification(title, {
    body,
    icon: "/octoband.png",
    data: { url: conversationId ? "/messages" : "/notifications" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ("focus" in c) return c.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
