// GET /api/admin/settings — all sections. POST — update one section.
import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { getSettings, updateSettings } from "@/lib/server/settings-admin";
import { updateSettingsSchema } from "@/lib/schemas/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    return json({ settings: await getSettings(caller) });
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = updateSettingsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await updateSettings(caller, parsed.data));
  });
}
