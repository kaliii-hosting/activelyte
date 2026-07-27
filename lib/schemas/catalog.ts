// Zod schemas for product + reward administration.

import { z } from "zod";
import { ROLES } from "@/lib/types/roles";

const points = z.number().int().min(0).max(1_000_000);

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  sku: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(64).optional(),
  rewardPoints: points,
  perUserDailyLimit: z.number().int().min(1).max(1000).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  barcode: z.string().trim().max(64).optional(),
  rewardPoints: points.optional(),
  perUserDailyLimit: z.number().int().min(1).max(1000).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const addProductCodesSchema = z.object({
  productId: z.string().min(1),
  points: points,
  codes: z.array(z.string().trim().min(3).max(200)).min(1).max(1000),
});
export type AddProductCodesInput = z.infer<typeof addProductCodesSchema>;

const roleEnum = z.enum(ROLES as unknown as [string, ...string[]]);

export const createRewardSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  pointsRequired: points,
  eligibleRoles: z.array(roleEnum).optional(),
  inventory: z.number().int().min(0).max(1_000_000).optional(),
  requiresApproval: z.boolean().optional(),
});
export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = z.object({
  rewardId: z.string().min(1),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  pointsRequired: points.optional(),
  inventory: z.number().int().min(0).max(1_000_000).optional(),
  requiresApproval: z.boolean().optional(),
  active: z.boolean().optional(),
});
export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;
