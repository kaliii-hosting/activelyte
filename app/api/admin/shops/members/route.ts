// POST /api/admin/shops/members — add (or update) a shop member.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { addShopMember } from "@/lib/server/shop-admin";
import { addShopMemberSchema } from "@/lib/schemas/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = addShopMemberSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await addShopMember(caller, parsed.data));
  });
}
