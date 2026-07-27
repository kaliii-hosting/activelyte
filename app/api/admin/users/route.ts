// GET /api/admin/users — list users in the caller's organization.
//
// NOTE: these admin Route Handlers use the Node.js runtime (Admin SDK) and are
// intentionally NOT compatible with `output: export`. For the Capacitor build
// (Phase 8) the app is served as a hosted Next app, or these move to callable
// Cloud Functions — the logic in lib/server/user-admin.ts is written to lift
// over unchanged.

import { requireCaller } from "@/lib/server/authorize";
import { handle, json } from "@/lib/server/http";
import { listUsers } from "@/lib/server/user-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const users = await listUsers(caller);
    return json({ users });
  });
}
