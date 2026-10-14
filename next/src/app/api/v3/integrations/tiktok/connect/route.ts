import { authorized, json } from "@/lib/server/http";
import { beginConnect } from "@/lib/server/tiktok/service";
import { bindingCookie, tiktokContext, tiktokLimits } from "@/lib/server/tiktok/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operator only (enforced by `authorized`: session, workspace context, CSRF marker). Starts the OAuth flow; the page then navigates to TikTok. */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access) => {
    tiktokLimits.check(`connect:${access.actorId}`, 10, 600_000);
    const ctx = await tiktokContext(authority.db);
    const started = beginConnect(ctx, access.actorId);
    const response = json({ authorizeUrl: started.authorizeUrl });
    response.headers.append("Set-Cookie", bindingCookie(started.binding, started.ttlSeconds));
    return response;
  });
}
