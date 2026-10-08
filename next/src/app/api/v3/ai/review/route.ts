import { summarizePriorSessions } from "@/lib/ai/context";
import { AuthorityError } from "@/lib/server/config";
import { authorized, json } from "@/lib/server/http";
import { aiStatus } from "@/lib/server/ai/config";
import { AI_RATE, aiLimits, logAi, resolveTarget } from "@/lib/server/ai/http";
import { runReview } from "@/lib/server/ai/service";
import { latestEvidence } from "@/lib/server/liveIntelligence/service";
import { getRuntime } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Operator only. Reads the recorded evidence of ONE ended show and answers with a summary and suggestions. Read-only. */
export async function POST(request: Request): Promise<Response> {
  return authorized(request, async (authority, access, requestId) => {
    const status = aiStatus();
    if (status.state === "not_configured") return json({ status: "not_configured", configIssues: status.configIssues });
    aiLimits.check(`ai:${access.actorId}`, AI_RATE.limit, AI_RATE.windowMs);
    const target = await resolveTarget(request, authority, access);
    if (target.session.lifecycle !== "ended") throw new AuthorityError(409, "invalid_state", "The Review Copilot needs a show that has ended.");
    const laterEvidence = latestEvidence(authority, (await getRuntime()).config.dbPath, target.session);
    const result = await runReview(target.session, summarizePriorSessions(target.session, target.others), { laterEvidence });
    logAi(requestId, "/api/v3/ai/review", "review", result);
    return json(result);
  });
}
