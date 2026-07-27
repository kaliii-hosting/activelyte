// Client attachment uploads to Firebase Storage, with progress + cancel.
// Uploads land at conversations/{cid}/{uid}/{ts}_{name}; the {uid} segment is
// enforced by Storage rules. After upload, message-service references the
// returned metadata in a Firestore message.

import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { firebaseStorage } from "@/lib/firebase/client";
import type { Attachment, AttachmentKind } from "@/lib/types/models";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB — in sync with rules

export function kindFromContentType(contentType: string): AttachmentKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "voice";
  return "file";
}

export type UploadHandle = {
  promise: Promise<Attachment>;
  cancel: () => void;
};

export function uploadAttachment(
  conversationId: string,
  uid: string,
  file: Blob,
  fileName: string,
  opts?: { durationMs?: number; onProgress?: (pct: number) => void },
): UploadHandle {
  const contentType = file.type || "application/octet-stream";
  const kind = kindFromContentType(contentType);
  const safeName = fileName.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
  const path = `conversations/${conversationId}/${uid}/${Date.now()}_${safeName}`;

  const task = uploadBytesResumable(ref(firebaseStorage(), path), file, {
    contentType,
  });

  const promise = new Promise<Attachment>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) =>
        opts?.onProgress?.(
          snap.totalBytes
            ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            : 0,
        ),
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({
          kind,
          url,
          path,
          name: safeName,
          size: file.size,
          contentType,
          ...(opts?.durationMs ? { durationMs: opts.durationMs } : {}),
        });
      },
    );
  });

  return { promise, cancel: () => task.cancel() };
}
