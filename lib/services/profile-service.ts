// Self-service profile + preferences. A user may edit only their own display
// name, photo, and preferences (Security Rules enforce the field allowlist).

import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";

export type UserPreferences = {
  pushEnabled?: boolean;
  notifyMessages?: boolean;
  notifyBroadcasts?: boolean;
  notifyRewards?: boolean;
};

export type MyProfile = {
  displayName?: string;
  photoURL?: string;
  preferences?: UserPreferences;
};

export function listenMyProfile(
  uid: string,
  cb: (p: MyProfile | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firestore(), "users", uid), (s) =>
    cb(s.exists() ? (s.data() as MyProfile) : null),
  );
}

export async function updateMyProfile(
  uid: string,
  patch: MyProfile,
): Promise<void> {
  await setDoc(
    doc(firestore(), "users", uid),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
