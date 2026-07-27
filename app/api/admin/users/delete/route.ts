// POST /api/admin/users/delete — permanently delete a user account.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { deleteUserAccount } from "@/lib/server/user-admin";
import { deleteUserSchema } from "@/lib/schemas/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = deleteUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await deleteUserAccount(caller, { uid: parsed.data.uid }));
  });
}
