import { AiRequestSchema, type AiTask, type OperateResult, type ReviewResult } from "@/contracts/ai";
import { SessionSchema, type Session } from "@/contracts";
import { effectiveNowMs } from "@/lib/domain";
import type { RoomAuthority } from "../authority";
import { Limiter, readJson } from "../boundary";
import { AuthorityError, type Access } from "../config";
import { log } from "../log";
import { resultCode } from "./service";

/** Model calls cost money and time: one operator may ask this often. Per actor, in-process, like the other limiters. */
export const aiLimits = new Limiter();
export const AI_RATE = { limit: 20, windowMs: 600_000 } as const;
const BODY_LIMIT = 1_048_576;

export interface AiTarget {
  session: Session;
  /** The show's own clock now: the room's time for REAL, the virtual clock for SIMULATED. */
  nowMs: number;
  /** Other shows the same evidence rules allow as history (same environment only). */
  others: Session[];
}

/**
 * Where the evidence comes from, and why a browser cannot forge it.
 *   REAL       the body names a session id; the server reads it from the room (and the room's clock). Anything else
 *              in the body is ignored, so an operator cannot hand the Copilot invented REAL evidence.
 *   SIMULATED  the rehearsal exists only in the browser, so it is sent whole, validated against the session schema,
 *              and refused if it claims to be REAL.
 */
export async function resolveTarget(request: Request, authority: RoomAuthority, access: Access): Promise<AiTarget> {
  const parsed = AiRequestSchema.safeParse(await readJson(request, BODY_LIMIT));
  if (!parsed.success) throw new AuthorityError(400, "invalid_request", "The request must name a show (sessionId).");
  const body = parsed.data;

  if (body.session !== undefined) {
    const session = SessionSchema.safeParse(body.session);
    if (!session.success || session.data.id !== body.sessionId) throw new AuthorityError(400, "invalid_request", "The rehearsal in the request is not valid.");
    if (session.data.environment !== "SIMULATED") {
      throw new AuthorityError(400, "invalid_request", "Only SIMULATED rehearsals can be sent from the browser. REAL shows are read from the room.");
    }
    return { session: session.data, nowMs: effectiveNowMs(session.data, Date.now()), others: [] };
  }

  const read = authority.read(access);
  if (!read.changed) throw new AuthorityError(409, "invalid_state", "The room snapshot is unavailable.");
  const session = read.sessions.find((s) => s.id === body.sessionId);
  if (!session) throw new AuthorityError(404, "not_found", "That show is not in this room.");
  return { session, nowMs: read.serverNowMs, others: read.sessions };
}

export function logAi(requestId: string, route: string, task: AiTask, result: OperateResult | ReviewResult): void {
  log("ai_request", { requestId, route, resultCode: resultCode(task, result) }, result.status === "available" || result.status === "not_configured" ? "info" : "warn");
}
