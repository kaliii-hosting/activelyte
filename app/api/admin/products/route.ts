// GET /api/admin/products — list. POST — create.
import { requireCaller } from "@/lib/server/authorize";
import { handle, json, HttpError } from "@/lib/server/http";
import { listProducts, createProduct } from "@/lib/server/catalog-admin";
import { createProductSchema } from "@/lib/schemas/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    return json({ products: await listProducts(caller) });
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const caller = await requireCaller(req);
    const parsed = createProductSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    return json(await createProduct(caller, parsed.data));
  });
}
