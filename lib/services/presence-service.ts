// Presence + typing indicators via the Realtime Database (ephemeral state only
// — never persisted to Firestore). RTDB is used here because of its native
// onDisconnect support, which reliably flips a user offline when their
// connection drops.

import {
  onValue,
  onDisconnect,
  ref,
  remove,
  serverTimestamp,
  set,
  type Unsubscribe,
} from "firebase/database";
import { rtdb } from "@/lib/firebase/client";

export type Presence = { state: "online" | "offline"; lastChanged: number };

// Typing entries older than this are treated as stale (client stopped without
// clearing, e.g. tab closed mid-type before onDisconnect fired).
const TYPING_TTL_MS = 6000;

/**
 * Begin publishing presence for `uid`. Sets online now, registers an
 * onDisconnect handler to flip offline, and re-arms on every reconnect.
 * Returns a cleanup that marks offline and stops listening.
 */
export function initPresence(uid: string): Unsubscribe {
  const db = rtdb();
  const statusRef = ref(db, `status/${uid}`);
  const connectedRef = ref(db, ".info/connected");

  const unsub = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    // Arm the disconnect write first, then go online — order matters so a drop
    // between the two still leaves a correct offline record.
    onDisconnect(statusRef)
      .set({ state: "offline", lastChanged: serverTimestamp() })
      .then(() => set(statusRef, { state: "online", lastChanged: serverTimestamp() }))
      .catch(() => {});
  });

  return () => {
    unsub();
    set(statusRef, { state: "offline", lastChanged: serverTimestamp() }).catch(() => {});
  };
}

/** Subscribe to a single user's presence. */
export function listenPresence(
  uid: string,
  cb: (presence: Presence | null) => void,
): Unsubscribe {
  return onValue(ref(rtdb(), `status/${uid}`), (snap) => {
    cb((snap.val() as Presence) ?? null);
  });
}

/** Set or clear the current user's typing flag in a conversation. */
export async function setTyping(
  conversationId: string,
  uid: string,
  typing: boolean,
): Promise<void> {
  const node = ref(rtdb(), `typing/${conversationId}/${uid}`);
  if (typing) {
    await set(node, Date.now());
    onDisconnect(node).remove().catch(() => {});
  } else {
    await remove(node);
  }
}

/**
 * Subscribe to who (other than `selfUid`) is typing in a conversation.
 * Filters out self and stale entries.
 */
export function listenTyping(
  conversationId: string,
  selfUid: string,
  cb: (typingUids: string[]) => void,
): Unsubscribe {
  return onValue(ref(rtdb(), `typing/${conversationId}`), (snap) => {
    const val = (snap.val() as Record<string, number> | null) ?? {};
    const now = Date.now();
    const uids = Object.entries(val)
      .filter(([uid, ts]) => uid !== selfUid && now - Number(ts) < TYPING_TTL_MS)
      .map(([uid]) => uid);
    cb(uids);
  });
}
