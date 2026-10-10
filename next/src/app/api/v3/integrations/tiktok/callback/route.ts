import { AuthorityError } from "@/lib/server/config";
import { clientIp } from "@/lib/server/boundary";
import { boundary, productionRuntime } from "@/lib/server/http";
import { completeCallback } from "@/lib/server/tiktok/service";
import { callbackRedirect, readBinding, tiktokLimits } from "@/lib/server/tiktok/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TikTok redirects the browser here. There is no session cookie on this cross-site navigation, so authority comes only
 * from the single-use state + binding cookie. The browser is always sent back to /integrations with a fixed outcome code.
 */
export async function GET(request: Request): Promise<Response> {
  return boundary(request, async () => {
    const { production, authority } = await productionRuntime();
    try {
      // Only failed attempts count, so a flood of bad callbacks cannot be used to starve real sign-ins that succeed.
      const key = `callback:${clientIp(request, production)}`;
      tiktokLimits.check(key, 30, 900_000, false);
      const outcome = await completeCallback({ production, authorityDb: authority.db }, new URL(request.url), readBinding(request));
      if (outcome !== "connected" && outcome !== "denied") tiktokLimits.failure(key, 900_000);
      return callbackRedirect(production.origin, outcome);
    } catch (error) {
      // A top-level navigation should land on a page, not a JSON error.
      if (error instanceof AuthorityError) return callbackRedirect(production.origin, error.status === 429 ? "state_invalid" : "provider_unavailable");
      throw error;
    }
  });
}
