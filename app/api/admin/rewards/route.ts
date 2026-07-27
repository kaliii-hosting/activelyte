import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { listRewards, createReward } from "@/lib/server/catalog-admin";
import { createRewardSchema } from "@/lib/schemas/catalog";
import type { Role } from "@/lib/types/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    return json({ rewards: await listRewards(caller) });
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = createRewardSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await createReward(caller, { ...parsed.data, eligibleRoles: parsed.data.eligibleRoles as Role[] | undefined }));
  });
}
