// Core Firestore document models (Phase 1 + 2 subset).
//
// Later phases (shops, messaging, rewards, products) extend this file. Every
// business record carries the audit envelope below. Timestamps are Firestore
// Timestamps on read; writes use serverTimestamp(). We model them loosely as
// `unknown`-friendly here and narrow at the service boundary.

import type { Role } from "./roles";

export type UserStatus = "active" | "invited" | "disabled";

// The audit envelope every business record includes (see AGENTS spec).
export type AuditFields = {
  createdAt: unknown; // Firestore Timestamp | FieldValue (serverTimestamp)
  createdBy: string; // uid
  updatedAt: unknown;
  updatedBy: string; // uid
};

export type Organization = {
  id: string;
  name: string;
  status: "active" | "suspended";
} & AuditFields;

// users/{uid}
export type UserProfile = {
  uid: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  photoURL?: string;
  emailVerified: boolean;
  // Denormalized shop memberships for quick UI reads; authoritative membership
  // lives in shops/{shopId}/members/{uid}.
  shopIds?: string[];
} & AuditFields;

// users/{uid}/devices/{deviceId} — one FCM registration per device.
export type UserDevice = {
  deviceId: string;
  fcmToken: string;
  platform: "web" | "ios" | "android";
  lastSeenAt: unknown;
  createdAt: unknown;
};

export type NotificationType =
  | "message"
  | "broadcast"
  | "points_earned"
  | "reward_approved"
  | "reward_rejected"
  | "announcement";

// notifications/{id} — in-app notification records (also drive push).
export type AppNotification = {
  id: string;
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: unknown;
};

export type ShopStatus = "active" | "inactive";

// shops/{shopId}
export type Shop = {
  id: string;
  organizationId: string;
  name: string;
  status: ShopStatus;
  address?: string;
  // Denormalized current owner for quick display; authoritative owner is the
  // member doc with memberRole "shop_owner".
  ownerUid?: string;
  ownerName?: string;
} & AuditFields;

export type ConversationType = "direct" | "group" | "broadcast";

// conversations/{conversationId}. memberIds is a bounded array (direct=2,
// groups capped) used for array-contains list queries and membership rules.
export type Conversation = {
  id: string;
  organizationId: string;
  type: ConversationType;
  memberIds: string[];
  title?: string; // groups
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastMessage?: { text: string; senderId: string; at: unknown };
};

// conversations/{conversationId}/members/{uid} — per-member state.
export type ConversationMemberState = {
  uid: string;
  joinedAt: unknown;
  lastReadAt?: unknown;
  muted?: boolean;
};

export type MessageType = "text" | "image" | "file" | "voice";

export type AttachmentKind = "image" | "file" | "voice";

export type Attachment = {
  kind: AttachmentKind;
  url: string;
  path: string; // Storage path, kept for potential deletion/cleanup
  name: string;
  size: number;
  contentType: string;
  durationMs?: number; // voice notes
};

// conversations/{conversationId}/messages/{messageId}
export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  text?: string; // required for text; optional caption for attachments
  attachment?: Attachment;
  createdAt: unknown;
  editedAt?: unknown;
  deleted?: boolean;
};

// ---- Products + scanning (Phase 5) -----------------------------------------

export type ProductStatus = "active" | "inactive";

// products/{productId}
export type Product = {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  sku?: string;
  imageUrl?: string;
  // Shared UPC/EAN barcode identifying the product TYPE. Scanning it earns
  // points subject to limits (not a one-time secure code).
  barcode?: string;
  rewardPoints: number; // points earned per qualifying scan
  status: ProductStatus;
  // Anti-abuse: max qualifying scans of this product's barcode per user per day.
  perUserDailyLimit?: number;
} & AuditFields;

// productCodes/{codeId} — UNIQUE serialized one-time reward codes. The plaintext
// code is never stored; codeId is a hash of it. Redeemable exactly once.
export type ProductCodeStatus = "active" | "redeemed" | "void";
export type ProductCode = {
  id: string; // = hash(code)
  organizationId: string;
  productId: string;
  points: number;
  status: ProductCodeStatus;
  redeemedBy?: string;
  redeemedAt?: unknown;
} & AuditFields;

// scanEvents/{scanId} — audit trail of every scan attempt/award.
export type ScanEvent = {
  id: string;
  organizationId: string;
  userId: string;
  productId?: string;
  codeId?: string;
  mode: "product" | "unique";
  pointsAwarded: number;
  createdAt: unknown;
};

// ---- Loyalty (Phase 6) -----------------------------------------------------

// loyaltyAccounts/{uid} — cached balance; source of truth is the ledger.
export type LoyaltyAccount = {
  uid: string;
  organizationId: string;
  balance: number;
  lifetimeEarned: number;
  updatedAt: unknown;
};

export type LoyaltyTxnType =
  | "earn"
  | "redeem"
  | "adjustment"
  | "reversal"
  | "bonus";

// loyaltyTransactions/{id} — IMMUTABLE ledger. Never updated or deleted.
export type LoyaltyTransaction = {
  id: string;
  accountId: string; // uid
  organizationId: string;
  type: LoyaltyTxnType;
  points: number; // signed: +earn / -redeem
  sourceType: "scan" | "redemption" | "admin";
  sourceId?: string;
  idempotencyKey: string;
  balanceAfter: number;
  description?: string;
  createdAt: unknown;
  createdBy: string;
};

// ---- Rewards (Phase 6) -----------------------------------------------------

export type Reward = {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  pointsRequired: number;
  eligibleRoles?: Role[];
  inventory?: number; // undefined = unlimited
  active: boolean;
  requiresApproval?: boolean;
} & AuditFields;

export type RedemptionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

// redemptions/{id}
export type Redemption = {
  id: string;
  organizationId: string;
  rewardId: string;
  rewardTitle: string;
  userId: string;
  pointsSpent: number;
  status: RedemptionStatus;
  createdAt: unknown;
  decidedAt?: unknown;
  decidedBy?: string;
};

export type ShopMemberRole = "shop_owner" | "bartender";
export type ShopMemberStatus = "active" | "invited";

// shops/{shopId}/members/{userId} — membership as documents, never arrays, so
// membership scales and is individually queryable/auditable.
export type ShopMember = {
  userId: string;
  shopId: string;
  organizationId: string;
  memberRole: ShopMemberRole;
  status: ShopMemberStatus;
  displayName: string;
  email: string;
  addedAt: unknown;
  addedBy: string;
};
