import { authorized, json } from "@/lib/server/http";
import { refreshConnection } from "@/lib/server/tiktok/service";
import { tiktokContext, tiktokLimits } from "@/lib/server/tiktok/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operator only. Renews the access token if needed and re-reads the TikTok profile; answers with the resulting status. */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    tiktokLimits.check(`refresh:${access.actorId}`, 30, 600_000);
    return json(await refreshConnection(await tiktokContext(authority.db)));
  });
}
