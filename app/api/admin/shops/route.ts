// GET /api/admin/shops — list shops in the caller's org.
// POST /api/admin/shops — create a shop.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { listShops, createShop } from "@/lib/server/shop-admin";
import { createShopSchema } from "@/lib/schemas/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    return json({ shops: await listShops(caller) });
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = createShopSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await createShop(caller, parsed.data));
  });
}
