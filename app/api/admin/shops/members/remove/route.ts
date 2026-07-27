// POST /api/admin/shops/members/remove — remove a shop member.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { removeShopMember } from "@/lib/server/shop-admin";
import { removeShopMemberSchema } from "@/lib/schemas/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = removeShopMemberSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await removeShopMember(caller, parsed.data));
  });
}
