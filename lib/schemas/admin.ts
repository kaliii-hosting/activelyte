// Zod schemas for privileged admin operations. Validated on the server before
// any Admin SDK call — never trust the client.

import { z } from "zod";
import { ROLES } from "@/lib/types/roles";
import { emailSchema } from "./auth";

// Founder is excluded — it is seed-only and never assignable through the app.
const assignableRoleSchema = z.enum(
  ROLES.filter((r) => r !== "founder") as [string, ...string[]],
);

export const assignRoleSchema = z.object({
  uid: z.string().min(1),
  role: assignableRoleSchema,
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const inviteUserSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(80),
  role: assignableRoleSchema,
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const setStatusSchema = z.object({
  uid: z.string().min(1),
  status: z.enum(["active", "disabled"]),
});
export type SetStatusInput = z.infer<typeof setStatusSchema>;

export const deleteUserSchema = z.object({
  uid: z.string().min(1),
});
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
