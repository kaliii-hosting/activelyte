// Zod schemas for auth inputs. Used by the auth UI for client-side validation
// and (later) re-validated server-side in Cloud Functions — never trust the
// client alone.

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email");

// Firebase Auth requires >= 6 chars; we ask for a bit more strength.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(4096, "Password is too long");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const resetSchema = z.object({ email: emailSchema });
export type ResetInput = z.infer<typeof resetSchema>;
