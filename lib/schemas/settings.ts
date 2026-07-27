// Admin settings sections + validation. Values are a flat map of scalars per
// section, kept intentionally flexible (the UI defines the known fields).

import { z } from "zod";

export const SETTINGS_SECTIONS = [
  "general",
  "messaging",
  "rewards",
  "scanning",
  "featureFlags",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const updateSettingsSchema = z.object({
  section: z.enum(SETTINGS_SECTIONS),
  values: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()]),
  ),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
