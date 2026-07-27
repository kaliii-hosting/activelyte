// Seed the founder account — the single top-authority user that cannot be
// self-registered. Idempotent: safe to run repeatedly.
//
// What it does:
//   1. Ensures a default organization document exists.
//   2. Finds (or creates) the Firebase Auth user for FOUNDER_EMAIL.
//   3. Sets custom claims { role: "founder", organizationId }.
//   4. Writes/updates the users/{uid} Firestore profile.
//
// Run from the project root with Node 20.6+ (needs --env-file):
//   node --env-file=.env.local scripts/seed-founder.mjs
//
// Requires the server credentials in .env.local:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FOUNDER_EMAIL

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const DEFAULT_ORG_ID = "activelyte";
const DEFAULT_ORG_NAME = "Activelyte";

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const founderEmail = process.env.FOUNDER_EMAIL;

if (!projectId || !clientEmail || !privateKey) {
  fail(
    "Missing Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL " +
      "and FIREBASE_PRIVATE_KEY in .env.local, then run with --env-file=.env.local.",
  );
}
if (!founderEmail) fail("Set FOUNDER_EMAIL in .env.local.");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  // 1. Default organization ------------------------------------------------
  const orgRef = db.collection("organizations").doc(DEFAULT_ORG_ID);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    await orgRef.set({
      id: DEFAULT_ORG_ID,
      name: DEFAULT_ORG_NAME,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "system:seed",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system:seed",
    });
    console.log(`✓ Created organization "${DEFAULT_ORG_ID}"`);
  } else {
    console.log(`• Organization "${DEFAULT_ORG_ID}" already exists`);
  }

  // 2. Auth user -----------------------------------------------------------
  let user;
  try {
    user = await auth.getUserByEmail(founderEmail);
    console.log(`• Found existing user ${founderEmail} (${user.uid})`);
  } catch (err) {
    if (err?.code === "auth/user-not-found") {
      user = await auth.createUser({
        email: founderEmail,
        emailVerified: true,
        displayName: "Founder",
      });
      console.log(`✓ Created user ${founderEmail} (${user.uid})`);
      console.log(
        "  → Send a password-reset email so they can set a password, or set " +
          "one in the Firebase console.",
      );
    } else {
      throw err;
    }
  }

  // 3. Custom claims -------------------------------------------------------
  await auth.setCustomUserClaims(user.uid, {
    role: "founder",
    organizationId: DEFAULT_ORG_ID,
  });
  console.log(`✓ Set claims { role: "founder", organizationId: "${DEFAULT_ORG_ID}" }`);

  // 4. Firestore profile ---------------------------------------------------
  const userRef = db.collection("users").doc(user.uid);
  const existing = await userRef.get();
  await userRef.set(
    {
      uid: user.uid,
      organizationId: DEFAULT_ORG_ID,
      email: founderEmail,
      displayName: user.displayName ?? "Founder",
      role: "founder",
      status: "active",
      emailVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system:seed",
      ...(existing.exists
        ? {}
        : {
            createdAt: FieldValue.serverTimestamp(),
            createdBy: "system:seed",
          }),
    },
    { merge: true },
  );
  console.log(`✓ Wrote users/${user.uid} profile`);

  // 5. Password reset link — so the founder can set a password and sign in,
  //    even if the account was just created without one.
  try {
    const link = await auth.generatePasswordResetLink(founderEmail);
    console.log("\n🔑 Founder password setup link (send to them / open once):");
    console.log(`   ${link}`);
  } catch (err) {
    console.log(
      `\n(!) Could not generate a reset link automatically (${err?.code ?? err}).` +
        " Set a password in the Firebase console instead.",
    );
  }

  console.log("\n✅ Founder seeded.\n");
}

run().catch((err) => {
  console.error("\n✖ Seed failed:", err);
  process.exit(1);
});
