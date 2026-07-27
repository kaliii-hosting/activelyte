# Activelyte — Project Guide (help.md)

Everything you need to understand, run, and continue this project. Last updated
2026-07-26.

Activelyte is a **Next.js 16 + Firebase** loyalty & messaging app for shops and
bartenders. The front-end design (orange `#F5852A` "global illumination" glow,
octagon bottom-nav, device-frame aesthetic) is the presentation layer; Firebase
provides auth, data, real-time, storage, and server-authoritative business logic.

---

## 1. Quick start

```bash
# from the project root (/mnt/c/Users/mothe/Documents/GitHub/Activelyte)
npm install
npm run dev                # http://localhost:3000
```

Requires `.env.local` (already created — see §4). The founder account
(**kushieweb@gmail.com**) is already seeded on the live `activelyte` Firebase
project.

### Dev server speed (important)

`npm run dev` now uses **Turbopack** — routes compile in **~0.1–0.8s** (vs. 1–2
min on the old webpack setup). The `.next` cache is no longer wiped on start, so
restarts are fast too.

Tradeoff on `/mnt/c` (Windows drive over WSL's 9P mount): Turbopack can't receive
file-change events there, so **code edits don't hot-reload** — restart the dev
server to see changes. Two alternatives:

- `npm run dev:webpack` — webpack + polling: **auto-reloads on edit** but compiles
  slowly. Use while iterating on a single file.
- **Best of both:** copy the repo to the native WSL filesystem (`~/Activelyte`)
  and run `npm run dev` there — Turbopack gets native file events, giving fast
  compiles *and* hot reload. Edit via VS Code "Connect to WSL".

Backend correctness is verified directly against Firebase, independent of the dev
server.

---

## 2. Architecture at a glance

- **Auth:** Firebase Auth (email/password), client SDK. Roles/organization live
  in **custom claims** (`{role, organizationId}`) — the trusted source that
  Security Rules and Cloud Functions read. Client-side route guards are UX only.
- **Data:** Cloud Firestore. Clients read/write **only** what Security Rules
  allow. All privileged writes (roles, shops, catalog, points) happen **server-
  side** (Admin SDK via Next Route Handlers, or Cloud Functions) which bypass
  rules — so client writes to those collections are denied.
- **Real-time chat:** clients read/write conversations + messages directly via
  Firestore listeners, gated by member-based rules.
- **Ephemeral presence/typing:** Realtime Database (`onDisconnect` support).
- **Attachments:** Firebase Storage (10 GB/file limit — see §9).
- **Server-authoritative logic:** Cloud Functions (Gen 2, `us-central1`) —
  private broadcasts and the entire points/rewards engine. The browser can
  never award, deduct, or approve points directly.
- **No Next server sessions / `proxy.ts`:** deliberately, so the app stays
  static-export-friendly for the future Capacitor mobile build.

### Why this shape
Firebase's security model is server-authoritative (Rules + Functions), not Next
middleware. Keeping auth on the client + enforcing everything in Rules/Functions
means the same code path works on web today and in a Capacitor mobile shell later.

---

## 3. Roles

Descending authority: `founder > super_admin > admin > shop_owner > bartender >
client` (`lib/types/roles.ts`).

- **founder** — top authority, seed-only (can't be self-registered or assigned
  via the app). Configured as **kushieweb@gmail.com**.
- **admin tier** (founder/super_admin/admin) — manage members, shops, catalog,
  broadcasts, approvals.
- **shop_owner / bartender** — participate in messaging, scan for points, redeem
  rewards.
- **client** — minimal.

No-escalation rule: you can only grant roles strictly below your own rank
(`lib/authz.ts`). Enforced in code AND surfaced in UI.

---

## 4. Environment (`.env.local`)

Already populated with the real `activelyte` project config + service-account
credentials. Variable names (see `.env.example`):

- Client (public, safe): `NEXT_PUBLIC_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,
  STORAGE_BUCKET,MESSAGING_SENDER_ID,APP_ID,DATABASE_URL}`
- Not yet set: `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (web push — Phase 4.5),
  `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` (Phase 9)
- Server (secret): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`
- `FOUNDER_EMAIL=kushieweb@gmail.com`

`serviceAccountKey.json` (gitignored) holds the full service account, used for
CLI deploys via `GOOGLE_APPLICATION_CREDENTIALS`.

> **SECURITY TODO:** the service-account key was shared during setup. Rotate it
> before production: Firebase console → Project settings → Service accounts →
> generate a new key, delete the old, update `.env.local` + `serviceAccountKey.json`.

---

## 5. Deploying

```bash
export GOOGLE_APPLICATION_CREDENTIALS="$PWD/serviceAccountKey.json"

# rules & indexes (free)
npx firebase deploy --only firestore:rules,firestore:indexes --project activelyte --non-interactive
npx firebase deploy --only storage --project activelyte --non-interactive
npx firebase deploy --only database --project activelyte --non-interactive

# cloud functions (requires Blaze plan — already enabled)
npx firebase deploy --only functions --project activelyte --non-interactive
```

Firestore/Storage/RTDB rules, indexes, and all Cloud Functions are **already
deployed** to the live project.

---

## 6. Data model (Firestore collections)

| Collection | Purpose | Client access |
|---|---|---|
| `organizations/{id}` | tenant | read own org |
| `users/{uid}` (+`/devices`) | profile, role mirror | read same-org; writes Admin-only |
| `shops/{id}` (+`/members`) | shops + membership (docs, not arrays) | read same-org; writes Admin-only |
| `conversations/{id}` (+`/members`,`/messages`) | chat | members only (real-time) |
| `broadcasts/{id}` | admin record of a private broadcast | admin read; Function-write |
| `products/{id}` | product + barcode + points | read same-org; Admin-write |
| `productCodes/{sha256(code)}` | unique one-time reward codes (hashed) | **never client-readable**; Function-write |
| `scanEvents/{id}` | scan audit trail | read own/admin; Function-write |
| `loyaltyAccounts/{uid}` | cached point balance | read own/admin; Function-write |
| `loyaltyTransactions/{id}` | **immutable** points ledger | read own/admin; Function-write |
| `rewards/{id}` | reward catalog | read same-org; Admin-write |
| `redemptions/{id}` | redemption records | read own/admin; Function-write |
| `auditLogs/{id}` | append-only admin action log | admin read; Admin-write |

Every business record carries `organizationId, createdAt, createdBy, updatedAt,
updatedBy`. Rules: `firestore.rules`, `storage.rules`, `database.rules.json`,
indexes: `firestore.indexes.json`.

---

## 7. Cloud Functions (`functions/src/index.ts`)

All callable (v2, `us-central1`), verify the caller's ID-token claims:

- **`sendPrivateBroadcast({recipientUids, text})`** — admin-only. Fans out one
  *private* conversation per recipient (`type:broadcast`, `memberIds:[admin,
  recipient]`), so recipients never see each other (BCC).
- **`validateAndRedeemCode({code, idempotencyKey?})`** — scan → earn points.
  Handles unique one-time codes (marked redeemed atomically) and product
  barcodes (rate-limited per user/day). Idempotent — replays never double-credit.
- **`submitRedemption({rewardId})`** — spend points. Atomic deduct, rejects if
  insufficient, handles inventory + approval.
- **`decideRedemption({redemptionId, decision})`** — admin approve/reject;
  rejection refunds via a reversal ledger entry.

Points **only** move through these functions inside Firestore transactions. The
browser is denied all writes to loyalty/redemption collections by rules.

---

## 8. Feature status

### ✅ Done & verified end-to-end against live Firebase

| Phase | Feature |
|---|---|
| 1 | Foundation: Firebase client/admin init, types, Zod, env |
| 2 | Auth (login/signup/reset), roles via custom claims, founder seed, **members management** (invite/promote/disable, no-escalation), route guards, audit logs |
| 3 | **Shops & bartenders**: shop CRUD, owner/bartender membership (subcollection docs), activate/deactivate |
| 4.1 | **Messaging core**: direct + group conversations, real-time, read receipts, unread; **Security Rules foundation** |
| 4.2 | **Presence + typing** (Realtime DB) |
| 4.3 | **Attachments**: images/files/voice notes (Storage, 10 GB/file), upload progress |
| 4.4 | **Private broadcasts** (Cloud Function fan-out, BCC privacy) |
| 5 | **Products + scanning**: product/catalog admin, unique codes (hashed), barcode scanning wired to the existing camera scanner |
| 6 | **Rewards + loyalty**: immutable ledger, `validateAndRedeemCode` (earn), `submitRedemption` (spend), approvals/refunds, duplicate-scan + daily-limit + idempotency + insufficient-balance guards |
| 7 | **Admin settings**: `appSettings/*` per-org sections (general, messaging, rewards, scanning, feature flags), admin-only read + server-only write |

Verification approach: Node scripts using the **client SDK** (rules-enforced) +
**Admin SDK**, exercising the real deployed Functions/Rules, then cleaning up all
test data. Every guard (permission-denied, already-redeemed, limit-reached,
insufficient-points, cross-user/cross-org) was confirmed to actually fire.

| 4.5 | **Notifications + push**: `onMessageCreated` trigger writes in-app notifications + sends FCM; `/notifications` page; web + native token registration |
| 8 | **Capacitor**: config + native platform layer (push + MLKit barcode scan) behind web fallbacks; packages installed |
| 9 | **App Check + tests**: App Check init (reCAPTCHA v3, key-gated); authz unit tests (17 assertions, verified) |

### 🔑 Built — needs a one-time key/tooling to fully activate

| Item | What's needed | Without it |
|---|---|---|
| Web push | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` (console → Cloud Messaging → Web Push cert) | in-app notifications still work; no browser push |
| App Check | `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` (console → App Check → reCAPTCHA v3) | App Check inert (not enforced) |
| iOS/Android apps | Xcode / Android Studio + `npx cap add ios/android` | code ready; native projects not generated here |
| Unit tests | `npm i -D vitest` then `npm test` | authz already verified via integration + a compiled assertion run |

Messaging extras still open (nice-to-haves): message edit/delete/reply/search,
group membership editing after creation, exact per-conversation unread counts
(currently an unread indicator).

---

## 9. Key files

```
lib/
  env.ts, authz.ts                       # config; pure no-escalation policy
  types/{roles,models}.ts                # role model; all Firestore types
  schemas/{auth,admin,shop,catalog}.ts   # Zod validation
  firebase/{client,admin,auth}.ts        # SDK singletons (client + server)
  api-client.ts                          # Bearer-token fetch to admin routes
  server/{authorize,http,audit,user-admin,shop-admin,catalog-admin}.ts
  services/{directory,conversation-service,message-service,
            presence-service,attachment-service,broadcast-service,reward-service}.ts
components/
  auth/{auth-provider,auth-dialog,route-guard}.tsx
  admin/{members-manager,shops-manager,catalog-manager}.tsx
  messaging/messages-view.tsx
  rewards/rewards-view.tsx
  octagon-toolbar.tsx, top-header.tsx, screen-scanner.tsx   # existing design
app/
  page.tsx (dashboard), messages, rewards, shop, profile, notifications, settings
  admin/{members,shops,catalog}/page.tsx
  api/admin/{users,shops,products,rewards,redemptions,...}/route.ts
functions/src/index.ts                   # Cloud Functions
firestore.rules, storage.rules, database.rules.json, firestore.indexes.json
firebase.json, .firebaserc
```

---

## 10. How to operate the app

- **Founder first login:** open the app → *Login / Sign up* → use a password-
  reset link (generated by the seed) or *Forgot password?*. The founder then sees
  admin menu entries (Members, Shops, Catalog).
- **Add people:** Members → invite by email + role. They get a setup link.
- **Set up loyalty:** Catalog → create Products (with a barcode + points, and/or
  register unique codes) and Rewards. 
- **Earn/redeem:** members open Rewards to see their balance, redeem rewards, or
  enter a code; the **SCAN** button in the bottom bar scans a QR/barcode and
  awards points.
- **Chat:** Messages → direct/group; admins can send a private Broadcast.

---

## 11. How to finish the remaining phases

### Phase 7 — Admin settings (pure build, ~1 session)
1. Model `appSettings/{section}` docs (general, messaging, rewards, scanning,
   notifications, security, branding, featureFlags).
2. Add `lib/server/settings-admin.ts` (`getSettings`, `updateSettings`) +
   `app/api/admin/settings/route.ts` (GET/POST) — mirror `shop-admin`.
3. Rules: `match /appSettings/{s} { allow read: if isAdminTier() && ...; allow
   write: if false; }`.
4. UI: `components/admin/settings-manager.tsx` (tabbed sections) →
   `app/admin/settings/page.tsx`, add to `ADMIN_MENU`.

### Phase 4.5 — Push notifications
1. Get a **Web Push VAPID key**: console → Project settings → Cloud Messaging →
   Web Push certificates → generate; put in `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
2. `public/firebase-messaging-sw.js` service worker; register FCM token on login
   → `users/{uid}/devices/{deviceId}`.
3. Cloud Function `onDocumentCreated('conversations/{cid}/messages/{mid}')` →
   look up recipient device tokens → `getMessaging().sendEachForMulticast(...)`;
   also write a `notifications/{id}` doc for in-app.
4. Handle token refresh + invalid-token cleanup.

### Phase 8 — Capacitor (needs Xcode / Android Studio)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   @capacitor/push-notifications @capacitor/app @capacitor/preferences
   @capawesome/capacitor-mlkit-barcode-scanning`.
2. Decide output: either `output:'export'` static bundle, OR point Capacitor at
   a hosted URL (recommended here, because the admin API routes use the Node
   runtime — a static export would need those moved to Cloud Functions first).
3. `npx cap init`, `npx cap add ios/android`, camera/push permission entries,
   deep-link config, safe-area, Android back-button.

### Phase 9 — App Check + tests
1. App Check: register reCAPTCHA v3 in console → site key into
   `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`; init App Check in `client.ts`;
   enforce on Firestore/Storage/Functions.
2. Tests: `firebase emulators:start` (config already in `firebase.json`) +
   `@firebase/rules-unit-testing` for rule tests; unit-test `lib/authz.ts` and
   the Functions.

---

## 12. Gotchas / operational notes

- **New API routes need a dev-server restart** — Next 16 App Router on `/mnt/c`
  doesn't hot-register newly added `route.ts` files (they 404 until restart).
- **Verify the backend directly**, not through the slow dev server — Node scripts
  with the Admin + client SDKs hit real Firebase and are fast + reliable.
- **Composite indexes:** field order matters (equality fields then range). The
  scan daily-limit query needs `scanEvents(productId, userId, createdAt)`.
- **Idempotency before rate-limit:** in `validateAndRedeemCode`, the replay check
  runs before the daily-limit query so retries are never wrongly blocked.
- **Cloud Functions cleanup policy** set to delete build images after 1 day
  (avoids Artifact Registry storage creep).
```
