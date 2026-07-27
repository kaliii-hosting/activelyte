// Activelyte Cloud Functions — privileged server operations.
//
// These run with Admin privileges and are the ONLY way to perform actions the
// client is forbidden from doing directly (enforced by Security Rules). First
// function: private broadcasts (BCC-style fan-out).

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createHash } from "crypto";

initializeApp();
const db = getFirestore();

const ADMIN_ROLES = ["founder", "super_admin", "admin"];
const SCAN_ROLES = ["founder", "super_admin", "admin", "shop_owner", "bartender"];

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// Extract the verified caller identity from a callable request, or throw.
function requireAuth(request: CallableRequest<unknown>) {
  const auth = request.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const role = auth.token.role as string | undefined;
  const organizationId = auth.token.organizationId as string | undefined;
  if (!role || !organizationId) {
    throw new HttpsError("permission-denied", "Your account isn't set up for this.");
  }
  return { uid: auth.uid, role, organizationId };
}
const MAX_RECIPIENTS = 500;
const MAX_TEXT = 4000;

type BroadcastInput = { recipientUids?: unknown; text?: unknown };

/**
 * Send a private broadcast: an admin messages many recipients at once, but each
 * recipient gets their OWN private conversation with the admin. Recipients
 * never see each other, each other's replies, or each other's read state —
 * because each conversation's memberIds is just [admin, recipient].
 *
 * Only this function may create `type: "broadcast"` conversations; Security
 * Rules reject client-side broadcast creation.
 */
export const sendPrivateBroadcast = onCall(
  async (request: CallableRequest<BroadcastInput>) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError("unauthenticated", "Sign in required.");

    const role = auth.token.role as string | undefined;
    const organizationId = auth.token.organizationId as string | undefined;
    if (!role || !ADMIN_ROLES.includes(role) || !organizationId) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const { recipientUids, text } = request.data ?? {};
    if (!Array.isArray(recipientUids) || recipientUids.length === 0) {
      throw new HttpsError("invalid-argument", "Pick at least one recipient.");
    }
    if (recipientUids.length > MAX_RECIPIENTS) {
      throw new HttpsError("invalid-argument", `Too many recipients (max ${MAX_RECIPIENTS}).`);
    }
    if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT) {
      throw new HttpsError("invalid-argument", "Message is required (max 4000 chars).");
    }

    const adminUid = auth.uid;
    const body = text.trim();
    const recipients = [
      ...new Set(
        recipientUids.filter(
          (u): u is string => typeof u === "string" && u !== adminUid,
        ),
      ),
    ];
    if (recipients.length === 0) {
      throw new HttpsError("invalid-argument", "No valid recipients.");
    }

    const broadcastRef = db.collection("broadcasts").doc();
    const now = FieldValue.serverTimestamp();
    let delivered = 0;

    for (const recipientUid of recipients) {
      // Recipient must exist and belong to the same organization.
      const profile = await db.collection("users").doc(recipientUid).get();
      if (!profile.exists) continue;
      if (profile.data()?.organizationId !== organizationId) continue;

      const convId = `broadcast_${broadcastRef.id}_${recipientUid}`;
      const convRef = db.collection("conversations").doc(convId);
      const msgRef = convRef.collection("messages").doc();

      const batch = db.batch();
      batch.set(convRef, {
        id: convId,
        organizationId,
        type: "broadcast",
        broadcastId: broadcastRef.id,
        memberIds: [adminUid, recipientUid],
        createdBy: adminUid,
        createdAt: now,
        updatedAt: now,
        lastMessage: { text: body, senderId: adminUid, at: now },
      });
      batch.set(msgRef, {
        id: msgRef.id,
        conversationId: convId,
        senderId: adminUid,
        type: "text",
        text: body,
        createdAt: now,
      });
      batch.set(convRef.collection("members").doc(adminUid), {
        uid: adminUid,
        joinedAt: now,
        lastReadAt: now,
      });
      await batch.commit();
      delivered++;
    }

    await broadcastRef.set({
      id: broadcastRef.id,
      organizationId,
      text: body,
      recipientUids: recipients,
      delivered,
      createdBy: adminUid,
      createdAt: now,
    });

    return { broadcastId: broadcastRef.id, delivered };
  },
);

// ===========================================================================
// REWARDS ENGINE — server-authoritative. The browser NEVER awards, deducts, or
// approves points directly (Security Rules deny client writes to loyalty*).
// ===========================================================================

type ScanInput = { code?: unknown; idempotencyKey?: unknown };

/**
 * Validate a scanned code and award loyalty points. Handles two code modes:
 *  - UNIQUE serialized code (productCodes/{sha256(code)}): one-time; marked
 *    redeemed atomically so it can never be claimed twice.
 *  - PRODUCT barcode (products.barcode): repeatable, but rate-limited per user
 *    per day to prevent abuse.
 * Idempotent: a replayed request returns the original award, never double-credits.
 */
export const validateAndRedeemCode = onCall(
  async (request: CallableRequest<ScanInput>) => {
    const { uid, role, organizationId } = requireAuth(request);
    if (!SCAN_ROLES.includes(role)) {
      throw new HttpsError("permission-denied", "You can't scan for rewards.");
    }
    const code = String(request.data?.code ?? "").trim();
    if (!code) throw new HttpsError("invalid-argument", "No code provided.");

    const hash = sha256(code);
    const codeRef = db.doc(`productCodes/${hash}`);
    const codeSnap = await codeRef.get();

    let mode: "unique" | "product";
    let productId: string;
    let points: number;
    let idempotencyKey: string;
    let dailyLimit: number | undefined;

    if (codeSnap.exists) {
      const c = codeSnap.data()!;
      if (c.organizationId !== organizationId) {
        throw new HttpsError("not-found", "Code not recognized.");
      }
      mode = "unique";
      productId = c.productId;
      points = c.points ?? 0;
      // Per-(user,code): a same-user retry replays; a different user falls
      // through to the code-status check below and gets "already redeemed".
      idempotencyKey = `scan_unique_${hash}_${uid}`;
    } else {
      // Single-field query (no composite index needed); filter org/status here.
      const q = await db
        .collection("products")
        .where("barcode", "==", code)
        .limit(5)
        .get();
      const match = q.docs.find(
        (d) => d.data().organizationId === organizationId && d.data().status === "active",
      );
      if (!match) throw new HttpsError("not-found", "Code not recognized.");
      mode = "product";
      productId = match.id;
      points = match.data().rewardPoints ?? 0;
      dailyLimit = match.data().perUserDailyLimit as number | undefined;
      const key = String(request.data?.idempotencyKey ?? Date.now());
      idempotencyKey = `scan_${uid}_${productId}_${key}`;
    }

    const accRef = db.doc(`loyaltyAccounts/${uid}`);
    const txnRef = db.doc(`loyaltyTransactions/${idempotencyKey}`);
    const scanRef = db.collection("scanEvents").doc();
    const now = FieldValue.serverTimestamp();

    // Idempotency FIRST: a replayed request returns the original award and must
    // never be blocked by a rate limit that filled up after the first attempt.
    const pre = await txnRef.get();
    if (pre.exists) {
      const d = pre.data()!;
      return { replay: true, mode, pointsAwarded: d.points, newBalance: d.balanceAfter };
    }

    // Per-product daily limit applies only to genuinely new product scans.
    if (mode === "product" && dailyLimit && dailyLimit > 0) {
      const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
      const cnt = await db
        .collection("scanEvents")
        .where("productId", "==", productId)
        .where("userId", "==", uid)
        .where("createdAt", ">", since)
        .count()
        .get();
      if (cnt.data().count >= dailyLimit) {
        throw new HttpsError("resource-exhausted", "Daily scan limit reached for this product.");
      }
    }

    return db.runTransaction(async (t) => {
      const existing = await t.get(txnRef);
      if (existing.exists) {
        const d = existing.data()!;
        return { replay: true, mode, pointsAwarded: d.points, newBalance: d.balanceAfter };
      }
      if (mode === "unique") {
        const cs = await t.get(codeRef);
        if (!cs.exists) throw new HttpsError("not-found", "Code not recognized.");
        if (cs.data()!.status !== "active") {
          throw new HttpsError("already-exists", "This code has already been redeemed.");
        }
      }
      const acc = await t.get(accRef);
      const prevBal = acc.exists ? (acc.data()!.balance ?? 0) : 0;
      const prevLife = acc.exists ? (acc.data()!.lifetimeEarned ?? 0) : 0;
      const balanceAfter = prevBal + points;

      t.set(accRef, {
        uid,
        organizationId,
        balance: balanceAfter,
        lifetimeEarned: prevLife + points,
        updatedAt: now,
      }, { merge: true });
      t.set(txnRef, {
        id: idempotencyKey,
        accountId: uid,
        organizationId,
        type: "earn",
        points,
        sourceType: "scan",
        sourceId: productId,
        idempotencyKey,
        balanceAfter,
        description: mode === "unique" ? "Unique code redeemed" : "Product scan",
        createdAt: now,
        createdBy: uid,
      });
      t.set(scanRef, {
        id: scanRef.id,
        organizationId,
        userId: uid,
        productId,
        codeId: mode === "unique" ? hash : null,
        mode,
        pointsAwarded: points,
        createdAt: now,
      });
      if (mode === "unique") {
        t.update(codeRef, {
          status: "redeemed",
          redeemedBy: uid,
          redeemedAt: now,
          updatedAt: now,
          updatedBy: uid,
        });
      }
      return { replay: false, mode, pointsAwarded: points, newBalance: balanceAfter };
    });
  },
);

type RedeemInput = { rewardId?: unknown };

/** Spend points to redeem a reward. Deducts atomically; rejects if insufficient. */
export const submitRedemption = onCall(
  async (request: CallableRequest<RedeemInput>) => {
    const { uid, role, organizationId } = requireAuth(request);
    const rewardId = String(request.data?.rewardId ?? "");
    if (!rewardId) throw new HttpsError("invalid-argument", "No reward selected.");

    const rewardRef = db.doc(`rewards/${rewardId}`);
    const accRef = db.doc(`loyaltyAccounts/${uid}`);
    const redemptionRef = db.collection("redemptions").doc();
    const txnRef = db.doc(`loyaltyTransactions/redeem_${redemptionRef.id}`);
    const now = FieldValue.serverTimestamp();

    return db.runTransaction(async (t) => {
      const rewardSnap = await t.get(rewardRef);
      if (!rewardSnap.exists) throw new HttpsError("not-found", "Reward not found.");
      const reward = rewardSnap.data()!;
      if (reward.organizationId !== organizationId || reward.active !== true) {
        throw new HttpsError("failed-precondition", "Reward is not available.");
      }
      if (Array.isArray(reward.eligibleRoles) && reward.eligibleRoles.length &&
          !reward.eligibleRoles.includes(role)) {
        throw new HttpsError("permission-denied", "You're not eligible for this reward.");
      }
      if (typeof reward.inventory === "number" && reward.inventory <= 0) {
        throw new HttpsError("resource-exhausted", "This reward is out of stock.");
      }
      const cost = reward.pointsRequired ?? 0;
      const acc = await t.get(accRef);
      const bal = acc.exists ? (acc.data()!.balance ?? 0) : 0;
      if (bal < cost) throw new HttpsError("failed-precondition", "Not enough points.");

      const balanceAfter = bal - cost;
      const status = reward.requiresApproval ? "pending" : "approved";

      t.set(accRef, { uid, organizationId, balance: balanceAfter, updatedAt: now }, { merge: true });
      t.set(txnRef, {
        id: txnRef.id, accountId: uid, organizationId, type: "redeem", points: -cost,
        sourceType: "redemption", sourceId: redemptionRef.id, idempotencyKey: txnRef.id,
        balanceAfter, description: `Redeemed: ${reward.title}`, createdAt: now, createdBy: uid,
      });
      t.set(redemptionRef, {
        id: redemptionRef.id, organizationId, rewardId, rewardTitle: reward.title,
        userId: uid, pointsSpent: cost, status, createdAt: now,
      });
      if (typeof reward.inventory === "number") {
        t.update(rewardRef, { inventory: reward.inventory - 1, updatedAt: now });
      }
      return { redemptionId: redemptionRef.id, status, newBalance: balanceAfter };
    });
  },
);

type DecideInput = { redemptionId?: unknown; decision?: unknown };

/** Admin approves or rejects a pending redemption; rejection refunds points. */
export const decideRedemption = onCall(
  async (request: CallableRequest<DecideInput>) => {
    const { uid, role, organizationId } = requireAuth(request);
    if (!ADMIN_ROLES.includes(role)) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }
    const redemptionId = String(request.data?.redemptionId ?? "");
    const decision = request.data?.decision;
    if (!redemptionId || (decision !== "approve" && decision !== "reject")) {
      throw new HttpsError("invalid-argument", "Invalid request.");
    }
    const redRef = db.doc(`redemptions/${redemptionId}`);
    const now = FieldValue.serverTimestamp();

    return db.runTransaction(async (t) => {
      const snap = await t.get(redRef);
      if (!snap.exists) throw new HttpsError("not-found", "Redemption not found.");
      const r = snap.data()!;
      if (r.organizationId !== organizationId) {
        throw new HttpsError("permission-denied", "Different organization.");
      }
      if (r.status !== "pending") {
        throw new HttpsError("failed-precondition", "Already decided.");
      }
      if (decision === "reject") {
        // Refund the spent points via a reversal ledger entry.
        const accRef = db.doc(`loyaltyAccounts/${r.userId}`);
        const acc = await t.get(accRef);
        const bal = acc.exists ? (acc.data()!.balance ?? 0) : 0;
        const balanceAfter = bal + (r.pointsSpent ?? 0);
        const txnRef = db.doc(`loyaltyTransactions/refund_${redemptionId}`);
        t.set(accRef, { balance: balanceAfter, updatedAt: now }, { merge: true });
        t.set(txnRef, {
          id: txnRef.id, accountId: r.userId, organizationId, type: "reversal",
          points: r.pointsSpent ?? 0, sourceType: "redemption", sourceId: redemptionId,
          idempotencyKey: txnRef.id, balanceAfter, description: "Redemption rejected — refund",
          createdAt: now, createdBy: uid,
        });
      }
      t.update(redRef, {
        status: decision === "approve" ? "approved" : "rejected",
        decidedAt: now, decidedBy: uid,
      });
      return { ok: true, status: decision === "approve" ? "approved" : "rejected" };
    });
  },
);

// ===========================================================================
// NOTIFICATIONS + PUSH — a new message notifies every other conversation
// member: writes an in-app notification doc and sends FCM to their devices.
// ===========================================================================

export const onMessageCreated = onDocumentCreated(
  "conversations/{cid}/messages/{mid}",
  async (event) => {
    const msg = event.data?.data();
    if (!msg) return;
    const cid = event.params.cid;

    const convSnap = await db.doc(`conversations/${cid}`).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data()!;
    const organizationId: string = conv.organizationId;
    const recipients: string[] = (conv.memberIds ?? []).filter(
      (u: string) => u !== msg.senderId,
    );
    if (recipients.length === 0) return;

    // Sender display name for the notification title.
    let senderName = "New message";
    const senderSnap = await db.doc(`users/${msg.senderId}`).get();
    if (senderSnap.exists) senderName = senderSnap.data()!.displayName ?? senderName;

    const preview =
      msg.type === "text"
        ? String(msg.text ?? "")
        : msg.type === "image"
          ? "📷 Photo"
          : msg.type === "voice"
            ? "🎤 Voice message"
            : "📎 Attachment";
    const isBroadcast = conv.type === "broadcast";
    const now = FieldValue.serverTimestamp();

    for (const uid of recipients) {
      // 1) in-app notification doc
      const nRef = db.collection("notifications").doc();
      await nRef.set({
        id: nRef.id,
        organizationId,
        userId: uid,
        type: isBroadcast ? "broadcast" : "message",
        title: isBroadcast ? `Broadcast from ${senderName}` : senderName,
        body: preview.slice(0, 180),
        data: { conversationId: cid },
        read: false,
        createdAt: now,
      });

      // 2) push to the recipient's registered devices
      const devs = await db.collection(`users/${uid}/devices`).get();
      const tokens = devs.docs
        .map((d) => d.data().fcmToken as string | undefined)
        .filter((t): t is string => !!t);
      if (tokens.length === 0) continue;

      try {
        const res = await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: senderName, body: preview.slice(0, 180) },
          data: { conversationId: cid, type: isBroadcast ? "broadcast" : "message" },
        });
        // Clean up tokens the FCM service reports as invalid.
        res.responses.forEach((r, i) => {
          const code = r.error?.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-argument"
          ) {
            devs.docs[i]?.ref.delete().catch(() => {});
          }
        });
      } catch {
        /* push failures are non-fatal — the in-app notification still exists */
      }
    }
  },
);
