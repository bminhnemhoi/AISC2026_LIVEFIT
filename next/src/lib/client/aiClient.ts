import { z } from "zod";
import { AI_ROUTES, AiStatusSchema, OperateResultSchema, ReviewResultSchema, type AiRequest, type AiStatusView, type OperateResult, type ReviewResult } from "@/contracts/ai";
import { buildHeaders, classifyCode, readError, sendBounded, type RequestContext } from "./productionTransport";

/**
 * Typed client for the AI Copilot endpoints. Same rules as the other production clients: the session is an
 * HttpOnly cookie the server owns, every request carries the CSRF marker and the workspace context, and nothing
 * here can see an AI credential (the server never sends one and the browser never holds one).
 *
 * Every answer is parsed against the shared contract. An answer that does not fit is "invalid response", never
 * something half-trusted.
 */

export type AiCallResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "signed_out" }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; retryAfterSec: number | null }
  /** The show is not in a state the Copilot applies to (not running / not ended), or no longer exists. */
  | { kind: "not_applicable"; message: string }
  | { kind: "unavailable"; message: string };

export interface AiClient {
  getStatus(context: RequestContext): Promise<AiCallResult<AiStatusView>>;
  operate(context: RequestContext, request: AiRequest): Promise<AiCallResult<OperateResult>>;
  review(context: RequestContext, request: AiRequest): Promise<AiCallResult<ReviewResult>>;
}

const STATUS_TIMEOUT_MS = 10_000;
/** Above the server's own ceiling for a provider call (60 s), so a slow model is reported by the server, not cut off here. */
const GENERATE_TIMEOUT_MS = 70_000;

const INVALID = { status: "invalid_response", reason: "schema" } as const;

export function createAiClient(options: { fetchImpl?: typeof fetch } = {}): AiClient {
  async function call<T>(path: string, method: "GET" | "POST", context: RequestContext, body: unknown, schema: z.ZodType<T>, onUnparseable: T | null, timeoutMs: number): Promise<AiCallResult<T>> {
    const unsafe = method === "POST";
    const res = await sendBounded(options.fetchImpl, path, { method, headers: buildHeaders({ unsafe, context }), ...(unsafe ? { body: JSON.stringify(body) } : {}) }, timeoutMs);
    if (!res.ok) return { kind: "unavailable", message: res.message };
    if (res.status >= 200 && res.status < 300) {
      const parsed = schema.safeParse(res.body);
      if (parsed.success) return { kind: "ok", value: parsed.data };
      return onUnparseable === null ? { kind: "unavailable", message: "The server sent an AI status LiveLift could not trust." } : { kind: "ok", value: onUnparseable };
    }
    const code = classifyCode(res.status, res.body);
    if (res.status === 401) return { kind: "signed_out" };
    if (res.status === 429) {
      const header = res.headers.get("retry-after");
      return { kind: "rate_limited", retryAfterSec: header && /^\d{1,5}$/.test(header) ? Number(header) : null };
    }
    if (res.status === 403 && code !== "csrf_failed") return { kind: "forbidden" };
    if (res.status === 404 || res.status === 409) return { kind: "not_applicable", message: readError(res.body).message ?? "The Copilot does not apply to this show right now." };
    return { kind: "unavailable", message: readError(res.body).message ?? `The server answered ${res.status}.` };
  }

  return {
    getStatus: (context) => call(AI_ROUTES.status, "GET", context, null, AiStatusSchema, null, STATUS_TIMEOUT_MS),
    operate: (context, request) => call<OperateResult>(AI_ROUTES.operate, "POST", context, request, OperateResultSchema, INVALID, GENERATE_TIMEOUT_MS),
    review: (context, request) => call<ReviewResult>(AI_ROUTES.review, "POST", context, request, ReviewResultSchema, INVALID, GENERATE_TIMEOUT_MS),
  };
}
