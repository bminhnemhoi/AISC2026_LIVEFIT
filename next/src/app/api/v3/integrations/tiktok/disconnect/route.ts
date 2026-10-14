import { authorized, json } from "@/lib/server/http";
import { disconnect } from "@/lib/server/tiktok/service";
import { tiktokContext, tiktokLimits } from "@/lib/server/tiktok/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operator only. Erases local credentials always; TikTok revocation is reported as confirmed or unconfirmed, never assumed. */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    tiktokLimits.check(`disconnect:${access.actorId}`, 10, 600_000);
    return json(await disconnect(await tiktokContext(authority.db), access.actorId));
  });
}
