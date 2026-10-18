import { boundary, json, productionRuntime } from "@/lib/server/http";
import { ready } from "@/lib/server/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return boundary(request, async () => {
    const healthy = ready(await productionRuntime());
    return json(healthy ? { ready: true } : { error: { code: "storage_unavailable", message: "Storage is not ready." } }, healthy ? 200 : 503);
  });
}
