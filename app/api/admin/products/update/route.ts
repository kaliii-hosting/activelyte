import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { updateProduct } from "@/lib/server/catalog-admin";
import { updateProductSchema } from "@/lib/schemas/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = updateProductSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await updateProduct(caller, parsed.data));
  });
}
