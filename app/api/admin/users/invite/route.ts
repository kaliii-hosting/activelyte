// POST /api/admin/users/invite — invite a user by email and assign a role.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { inviteUser } from "@/lib/server/user-admin";
import { inviteUserSchema } from "@/lib/schemas/admin";
import type { Role } from "@/lib/types/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = inviteUserSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    const result = await inviteUser(caller, {
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      role: parsed.data.role as Role,
    });
    return json(result);
  });
}
