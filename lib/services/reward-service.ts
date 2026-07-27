// Client reward + loyalty service. Point-moving operations go through callable
// Cloud Functions (server-authoritative); reads use Firestore listeners gated by
// Security Rules (users read only their own loyalty data + the org catalog).

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { firestore, functionsClient } from "@/lib/firebase/client";
import type {
  LoyaltyAccount,
  LoyaltyTransaction,
  Redemption,
  Reward,
} from "@/lib/types/models";

export type ScanResult = {
  mode: "unique" | "product";
  pointsAwarded: number;
  newBalance: number;
  replay: boolean;
};

export async function scanCode(code: string, idempotencyKey?: string): Promise<ScanResult> {
  const fn = httpsCallable<{ code: string; idempotencyKey?: string }, ScanResult>(
    functionsClient(),
    "validateAndRedeemCode",
  );
  return (await fn({ code, idempotencyKey })).data;
}

export async function redeemReward(
  rewardId: string,
): Promise<{ redemptionId: string; status: string; newBalance: number }> {
  const fn = httpsCallable(functionsClient(), "submitRedemption");
  return (await fn({ rewardId })).data as {
    redemptionId: string; status: string; newBalance: number;
  };
}

export async function decideRedemption(
  redemptionId: string,
  decision: "approve" | "reject",
): Promise<{ ok: boolean; status: string }> {
  const fn = httpsCallable(functionsClient(), "decideRedemption");
  return (await fn({ redemptionId, decision })).data as { ok: boolean; status: string };
}

export function listenLoyalty(
  uid: string,
  cb: (account: LoyaltyAccount | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firestore(), "loyaltyAccounts", uid), (s) =>
    cb(s.exists() ? (s.data() as LoyaltyAccount) : null),
  );
}

export async function listActiveRewards(organizationId: string): Promise<Reward[]> {
  const snap = await getDocs(
    query(collection(firestore(), "rewards"), where("organizationId", "==", organizationId)),
  );
  return snap.docs
    .map((d) => d.data() as Reward)
    .filter((r) => r.active)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
}

export function listenMyRedemptions(
  uid: string,
  cb: (redemptions: Redemption[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firestore(), "redemptions"), where("userId", "==", uid)),
    (snap) => cb(snap.docs.map((d) => d.data() as Redemption)),
  );
}

export function listenMyTransactions(
  uid: string,
  cb: (txns: LoyaltyTransaction[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firestore(), "loyaltyTransactions"), where("accountId", "==", uid)),
    (snap) =>
      cb(
        snap.docs
          .map((d) => d.data() as LoyaltyTransaction)
          .sort((a, b) => millisOf(b.createdAt) - millisOf(a.createdAt)),
      ),
  );
}

function millisOf(v: unknown): number {
  return v && typeof (v as { toMillis?: () => number }).toMillis === "function"
    ? (v as { toMillis: () => number }).toMillis()
    : 0;
}
