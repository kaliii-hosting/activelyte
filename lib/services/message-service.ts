// Client message service — sending and live-reading messages within a
// conversation. Firestore client SDK, gated by Security Rules.

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { Attachment, Message } from "@/lib/types/models";

const PAGE = 200;

/** Live-ordered messages for a conversation (oldest → newest). */
export function listenMessages(
  conversationId: string,
  cb: (messages: Message[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(firestore(), "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
    limit(PAGE),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => d.data() as Message)),
    (err) => onError?.(err),
  );
}

/**
 * Send a text message and update the conversation's lastMessage preview.
 * Returns the new message id (useful for optimistic UI reconciliation).
 */
export async function sendTextMessage(
  conversationId: string,
  senderUid: string,
  text: string,
): Promise<string> {
  const db = firestore();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Message is empty.");

  const msgRef = doc(
    collection(db, "conversations", conversationId, "messages"),
  );
  await setDoc(msgRef, {
    id: msgRef.id,
    conversationId,
    senderId: senderUid,
    type: "text",
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: { text: trimmed, senderId: senderUid, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  return msgRef.id;
}

const ATTACHMENT_PREVIEW: Record<Attachment["kind"], string> = {
  image: "📷 Photo",
  file: "📎 File",
  voice: "🎤 Voice message",
};

/** Send an already-uploaded attachment as a message, with optional caption. */
export async function sendAttachmentMessage(
  conversationId: string,
  senderUid: string,
  attachment: Attachment,
  caption?: string,
): Promise<string> {
  const db = firestore();
  const trimmedCaption = caption?.trim();
  const msgRef = doc(
    collection(db, "conversations", conversationId, "messages"),
  );
  await setDoc(msgRef, {
    id: msgRef.id,
    conversationId,
    senderId: senderUid,
    type: attachment.kind,
    attachment,
    ...(trimmedCaption ? { text: trimmedCaption } : {}),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "conversations", conversationId), {
    lastMessage: {
      text: trimmedCaption || ATTACHMENT_PREVIEW[attachment.kind],
      senderId: senderUid,
      at: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
  return msgRef.id;
}
