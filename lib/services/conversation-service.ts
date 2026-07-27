// Client conversation service — creating and listing conversations, tracking
// per-member read state. Wraps the Firestore client SDK (real-time), gated by
// Security Rules. UI components call these, never the raw SDK.

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { Conversation, ConversationMemberState } from "@/lib/types/models";

type Me = { uid: string; organizationId: string };

// Deterministic id for a 1:1 conversation, so two people can never create
// duplicate direct threads (same inputs → same document id).
export function directConversationId(
  organizationId: string,
  a: string,
  b: string,
): string {
  return `direct_${organizationId}_${[a, b].sort().join("_")}`;
}

/**
 * Return the id of the direct conversation between `me` and `otherUid`,
 * creating it (and my member doc) if it doesn't exist yet.
 * NOTE: writes are sequential, not batched — rules for the member doc call
 * get() on the parent conversation, which must already be committed.
 */
export async function getOrCreateDirectConversation(
  me: Me,
  otherUid: string,
): Promise<string> {
  const db = firestore();
  const id = directConversationId(me.organizationId, me.uid, otherUid);
  const ref = doc(db, "conversations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id,
      organizationId: me.organizationId,
      type: "direct",
      memberIds: [me.uid, otherUid].sort(),
      createdBy: me.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, "conversations", id, "members", me.uid), {
      uid: me.uid,
      joinedAt: serverTimestamp(),
      lastReadAt: serverTimestamp(),
    });
  }
  return id;
}

/** Create a group conversation and return its id. */
export async function createGroupConversation(
  me: Me,
  title: string,
  memberIds: string[],
): Promise<string> {
  const db = firestore();
  const members = Array.from(new Set([me.uid, ...memberIds]));
  const ref = doc(collection(db, "conversations"));
  await setDoc(ref, {
    id: ref.id,
    organizationId: me.organizationId,
    type: "group",
    title: title.trim(),
    memberIds: members,
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "conversations", ref.id, "members", me.uid), {
    uid: me.uid,
    joinedAt: serverTimestamp(),
    lastReadAt: serverTimestamp(),
  });
  return ref.id;
}

/** Live list of my conversations, newest activity first. */
export function listenConversations(
  uid: string,
  cb: (conversations: Conversation[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(firestore(), "conversations"),
    where("memberIds", "array-contains", uid),
    orderBy("updatedAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Conversation)),
    (err) => onError?.(err),
  );
}

/** Live per-member state for a conversation (read receipts, unread). */
export function listenMemberStates(
  conversationId: string,
  cb: (byUid: Record<string, ConversationMemberState>) => void,
): Unsubscribe {
  return onSnapshot(
    collection(firestore(), "conversations", conversationId, "members"),
    (snap) => {
      const out: Record<string, ConversationMemberState> = {};
      snap.docs.forEach((d) => (out[d.id] = d.data() as ConversationMemberState));
      cb(out);
    },
  );
}

/** Mark a conversation read up to now for `uid`. */
export async function markConversationRead(
  conversationId: string,
  uid: string,
): Promise<void> {
  await setDoc(
    doc(firestore(), "conversations", conversationId, "members", uid),
    { uid, lastReadAt: serverTimestamp() },
    { merge: true },
  );
}

/** One-shot read of a conversation (e.g. to open one opened via a deep link). */
export async function getConversation(
  conversationId: string,
): Promise<Conversation | null> {
  const snap = await getDoc(doc(firestore(), "conversations", conversationId));
  return snap.exists() ? (snap.data() as Conversation) : null;
}

/** One-shot read of my member state (for computing unread in the list). */
export async function getMyMemberState(
  conversationId: string,
  uid: string,
): Promise<ConversationMemberState | null> {
  const snap = await getDoc(
    doc(firestore(), "conversations", conversationId, "members", uid),
  );
  return snap.exists() ? (snap.data() as ConversationMemberState) : null;
}
