// Zod schemas for shop + membership operations. Validated server-side before
// any Admin SDK write.

import { z } from "zod";

const nameSchema = z.string().trim().min(2, "Name is too short").max(80);
const addressSchema = z.string().trim().max(200).optional();

export const createShopSchema = z.object({
  name: nameSchema,
  address: addressSchema,
});
export type CreateShopInput = z.infer<typeof createShopSchema>;

export const updateShopSchema = z.object({
  shopId: z.string().min(1),
  name: nameSchema.optional(),
  address: addressSchema,
  status: z.enum(["active", "inactive"]).optional(),
});
export type UpdateShopInput = z.infer<typeof updateShopSchema>;

export const addShopMemberSchema = z.object({
  shopId: z.string().min(1),
  uid: z.string().min(1),
  memberRole: z.enum(["shop_owner", "bartender"]),
});
export type AddShopMemberInput = z.infer<typeof addShopMemberSchema>;

export const removeShopMemberSchema = z.object({
  shopId: z.string().min(1),
  uid: z.string().min(1),
});
export type RemoveShopMemberInput = z.infer<typeof removeShopMemberSchema>;
