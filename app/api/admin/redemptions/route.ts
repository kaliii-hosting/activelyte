// GET /api/admin/redemptions?pending=1 — admin view of redemptions.
import { requireCaller } from "@/lib/server/authorize";
import { handle, json } from "@/lib/server/http";
import { listRedemptions } from "@/lib/server/catalog-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const pending = new URL(req.url).searchParams.get("pending") === "1";
    return json({ redemptions: await listRedemptions(caller, pending) });
  });
}
