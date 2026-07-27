// Client-side org directory. Reads user profiles within the caller's
// organization (permitted by Security Rules: same-org read). Used to pick who
// to start a conversation with. Non-admins can use this — unlike the admin
// users API, it only exposes basic profile fields and is rule-gated.

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { Role } from "@/lib/types/roles";

export type DirectoryUser = {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
};

export async function listOrgUsers(
  organizationId: string,
): Promise<DirectoryUser[]> {
  const snap = await getDocs(
    query(
      collection(firestore(), "users"),
      where("organizationId", "==", organizationId),
    ),
  );
  return snap.docs
    .map((d) => {
      const v = d.data();
      return {
        uid: v.uid ?? d.id,
        displayName: (v.displayName as string) ?? "",
        email: (v.email as string) ?? "",
        role: v.role as Role,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
