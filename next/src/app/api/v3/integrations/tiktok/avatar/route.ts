import { AuthorityError } from "@/lib/server/config";
import { currentSession } from "@/lib/server/auth";
import { boundary, productionRuntime } from "@/lib/server/http";
import { fetchAvatar } from "@/lib/server/tiktok/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The TikTok avatar, relayed so the page's CSP can stay `img-src 'self'`. An <img> request cannot send the workspace
 * context headers, so this checks the signed-in session only. Any problem is a 404 and the UI shows initials.
 */
export async function GET(request: Request): Promise<Response> {
  return boundary(request, async () => {
    const { production, authority } = await productionRuntime();
    currentSession(authority.db, request);
    const avatar = await fetchAvatar({ production, authorityDb: authority.db });
    if (!avatar) throw new AuthorityError(404, "not_found", "No avatar is available.");
    return new Response(new Uint8Array(avatar.bytes), {
      headers: {
        "Content-Type": avatar.contentType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
      },
    });
  });
}
