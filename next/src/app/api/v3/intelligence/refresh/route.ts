import { authorized, json } from "@/lib/server/http";
import { getRuntime } from "@/lib/server/runtime";
import { refreshEvidence } from "@/lib/server/liveIntelligence/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access, _requestId, currentAccess) => {
    const result = await refreshEvidence(request, authority, access, currentAccess, (await getRuntime()).config.dbPath);
    const response = json(result);
    if ("retryAfterSec" in result && result.retryAfterSec) response.headers.set("Retry-After", String(result.retryAfterSec));
    return response;
  });
}
