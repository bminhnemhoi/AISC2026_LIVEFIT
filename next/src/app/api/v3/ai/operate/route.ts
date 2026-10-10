import { summarizePriorSessions } from "@/lib/ai/context";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";
import { aiStatus } from "@/lib/server/ai/config";
import { AI_RATE, aiLimits, logAi, resolveTarget } from "@/lib/server/ai/http";
import { runOperate } from "@/lib/server/ai/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Operator only. Reads evidence about ONE running show and answers with advice. It reads; it never writes: nothing
 * in this route can start, change, skip or apply anything in the show.
 */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access, requestId) => {
    const status = aiStatus();
    if (status.state === "not_configured") return json({ status: "not_configured", configIssues: status.configIssues });
    aiLimits.check(`ai:${access.actorId}`, AI_RATE.limit, AI_RATE.windowMs);
    const target = await resolveTarget(request, authority, access);
    if (target.session.lifecycle !== "active") throw new AuthorityError(409, "invalid_state", "The Operate Copilot needs a show that is running.");
    const result = await runOperate(target.session, target.nowMs, summarizePriorSessions(target.session, target.others));
    logAi(requestId, "/api/v3/ai/operate", "operate", result);
    return json(result);
  });
}
