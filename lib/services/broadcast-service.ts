// Client wrapper for the sendPrivateBroadcast callable Cloud Function. The
// callable transport attaches the user's ID token automatically; the function
// re-verifies admin authorization server-side.

import { httpsCallable } from "firebase/functions";
import { functionsClient } from "@/lib/firebase/client";

export async function sendPrivateBroadcast(
  recipientUids: string[],
  text: string,
): Promise<{ broadcastId: string; delivered: number }> {
  const fn = httpsCallable<
    { recipientUids: string[]; text: string },
    { broadcastId: string; delivered: number }
  >(functionsClient(), "sendPrivateBroadcast");
  const res = await fn({ recipientUids, text });
  return res.data;
}
