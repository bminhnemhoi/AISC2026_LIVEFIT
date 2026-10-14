import { authorized, json } from "@/lib/server/http";
import { tiktokStatus } from "@/lib/server/tiktok/service";
import { tiktokContext } from "@/lib/server/tiktok/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local read of the TikTok connection (no provider call). Operators and viewers may read; the view holds no credential. */
export async function GET(request: Request): Promise<Response> {
  return authorized(request, async (authority) => json(tiktokStatus(await tiktokContext(authority.db))));
}
