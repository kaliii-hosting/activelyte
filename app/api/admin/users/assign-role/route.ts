// POST /api/admin/users/assign-role — change a user's role.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { assignRole } from "@/lib/server/user-admin";
import { assignRoleSchema } from "@/lib/schemas/admin";
import type { Role } from "@/lib/types/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = assignRoleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    const result = await assignRole(caller, {
      uid: parsed.data.uid,
      role: parsed.data.role as Role,
    });
    return json(result);
  });
}
