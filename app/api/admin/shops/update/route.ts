// POST /api/admin/shops/update — edit a shop (name/address/status).

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { updateShop } from "@/lib/server/shop-admin";
import { updateShopSchema } from "@/lib/schemas/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = updateShopSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await updateShop(caller, parsed.data));
  });
}
