// GET /api/admin/shops/detail?shopId=... — one shop plus its member list.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { getShopDetail } from "@/lib/server/shop-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const shopId = new URL(req.url).searchParams.get("shopId");
    if (!shopId) throw new HttpError(400, "Missing shopId.");
    return json(await getShopDetail(caller, shopId));
  });
}
