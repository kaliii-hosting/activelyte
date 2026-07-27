# Firebase Setup

How to connect Activelyte to your Firebase project and activate authentication.
This covers Phase 1 (foundation) + Phase 2 (auth). Later phases add Firestore
Rules, Storage, Functions, Messaging, and App Check.

## Architecture decision (why it's built this way)

Auth runs on the **Firebase client SDK** with **client-side route guards**, and
all real security is enforced by **Firestore/Storage Security Rules + Cloud
Functions** (server-authoritative). We deliberately do NOT use Next.js server
session cookies / `proxy.ts` auth, because:

- Phase 8 packages the app for iOS/Android with Capacitor, which needs a
  static-export-friendly build. Server session middleware would block that.
- Firebase's security model already lives in Rules + Functions, not in the Next
  server. The Next app is effectively an SPA shell over Firebase.

The `role` and `organizationId` live in **Auth custom claims** (trusted by Rules
and Functions) and are mirrored onto the Firestore user profile for querying.
Hiding a UI control is never treated as authorization.

## 1. Get your client config (NEXT_PUBLIC_*)

Firebase console → **Project settings** (gear) → **General** → scroll to **Your
apps**. If there's no Web app, click **Add app → Web** and register one. Copy
the values from the `firebaseConfig` object into `.env.local`:

| .env.local key | firebaseConfig field |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | `databaseURL` (if you use RTDB) |

These are **not secrets** — they ship in the browser and only identify the
project. Security is enforced by Rules/Functions.

## 2. Enable Email/Password auth

Console → **Authentication** → **Get started** → **Sign-in method** →
enable **Email/Password**.

## 3. Get the Admin service-account key (SECRET)

Console → **Project settings** → **Service accounts** → **Generate new private
key**. This downloads a JSON file — **never commit it**. Copy three values from
it into `.env.local`:

| .env.local key | JSON field |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` (keep the quotes; leave the `\n` escapes as-is) |

## 4. Create `.env.local`

```bash
cp .env.example .env.local
# then fill in the values from steps 1 + 3
```

`FOUNDER_EMAIL` is already set to `kushieweb@gmail.com`.

## 5. Seed the founder account

The founder is the top authority and cannot be self-registered. Seed it once
(idempotent — safe to re-run):

```bash
node --env-file=.env.local scripts/seed-founder.mjs
```

This creates the default `organizations/activelyte` doc, ensures the founder
Auth user exists, sets custom claims `{ role: "founder", organizationId:
"activelyte" }`, and writes their `users/{uid}` profile. If the user was newly
created, set their password via a reset email or in the console so they can sign
in.

## 6. Run and verify

```bash
npm run dev
```

- Click **Login / Sign up** in the top header → the auth dialog opens.
- Sign in as the founder (or create a new account — new accounts have **no
  role** until an admin/seed assigns one; that's expected).
- The header shows the signed-in name; hovering shows the email + role. Click it
  to sign out.

## What's implemented so far (Phase 1 + 2)

- `lib/env.ts` — typed client config + `isFirebaseConfigured` guard
- `lib/firebase/client.ts` — client SDK singletons (+ emulator support)
- `lib/firebase/admin.ts` — server-only Admin SDK singletons
- `lib/types/roles.ts` — the 6-role model, hierarchy, claim shape
- `lib/types/models.ts` — Organization / UserProfile / UserDevice models
- `lib/schemas/auth.ts` — Zod login/signup/reset schemas
- `lib/firebase/auth.ts` — typed auth operations + friendly error mapping
- `components/auth/auth-provider.tsx` — global auth context (React context)
- `components/auth/auth-dialog.tsx` — login/signup/reset UI (Activelyte design)
- `components/auth/route-guard.tsx` — client route/role gate (UX only)
- `scripts/seed-founder.mjs` — founder seeding
- `top-header.tsx` — real auth wired in, replacing the old fake toggle

## Coming next (not yet built)

Phase 3 shops/bartenders, Phase 4 messaging, Phase 5 products/scanner, Phase 6
rewards, Phase 7 admin settings, Phase 8 Capacitor, Phase 9 Security Rules +
App Check + tests. Route guards and the invite/role workflows that assign roles
to non-founder users arrive in Phase 2's completion + Phase 3.
