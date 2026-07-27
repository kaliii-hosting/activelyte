// POST /api/admin/users/status — enable or disable a user account.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { setUserStatus } from "@/lib/server/user-admin";
import { setStatusSchema } from "@/lib/schemas/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = setStatusSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    const result = await setUserStatus(caller, {
      uid: parsed.data.uid,
      status: parsed.data.status,
    });
    return json(result);
  });
}
