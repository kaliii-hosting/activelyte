// Admin settings storage. One doc per (org, section): appSettings/{org}__{section}.
// Admin-tier only, org-scoped, audited. Values validated by Zod at the route.

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpError } from "./http";
import { type Caller } from "./authorize";
import { isAdminRole } from "@/lib/types/roles";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/schemas/settings";

function requireAdmin(caller: Caller): void {
  if (!isAdminRole(caller.role) || !caller.organizationId) {
    throw new HttpError(403, "You don't have permission to change settings.");
  }
}
const docId = (org: string, section: string) => `${org}__${section}`;

/** All settings sections for the caller's org, as { section: values }. */
export async function getSettings(
  caller: Caller,
): Promise<Record<string, Record<string, unknown>>> {
  requireAdmin(caller);
  const org = caller.organizationId!;
  const out: Record<string, Record<string, unknown>> = {};
  await Promise.all(
    SETTINGS_SECTIONS.map(async (section) => {
      const snap = await adminDb().collection("appSettings").doc(docId(org, section)).get();
      const data = snap.exists ? snap.data()! : {};
      // Strip envelope fields from the returned values.
      const { organizationId, section: _s, updatedAt, updatedBy, ...values } = data;
      void organizationId; void _s; void updatedAt; void updatedBy;
      out[section] = values;
    }),
  );
  return out;
}

export async function updateSettings(
  caller: Caller,
  input: { section: SettingsSection; values: Record<string, string | number | boolean> },
): Promise<{ ok: true }> {
  requireAdmin(caller);
  const org = caller.organizationId!;
  await adminDb()
    .collection("appSettings")
    .doc(docId(org, input.section))
    .set(
      {
        organizationId: org,
        section: input.section,
        ...input.values,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: caller.uid,
      },
      { merge: true },
    );
  return { ok: true };
}
