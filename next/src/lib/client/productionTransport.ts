import type { ProductionContext, ProductionErrorCode } from "@/contracts/production";

/**
 * Shared transport rules for the production deployment (docs/phase3/contract.md).
 *
 * Authentication is an HttpOnly cookie the SERVER manages; the browser attaches it to same-origin requests by
 * itself. Nothing here reads, stores or forwards a credential, and no token header exists.
 *
 * Every request carries the CSRF marker. Unsafe requests also carry `Content-Type: application/json`. Requests
 * about the room, a receipt or an export carry the deployment context of the CURRENT authenticated session; the
 * server compares it with its own metadata and never lets it select authority.
 */

export const REQUEST_MARKER_HEADER = "X-LiveLift-Request";
export const WORKSPACE_HEADER = "X-LiveLift-Workspace";
export const GENERATION_HEADER = "X-LiveLift-Generation";

export const SESSION_PATH = "/api/v3/auth/session";
export const LOGIN_PATH = "/api/v3/auth/login";
export const LOGOUT_PATH = "/api/v3/auth/logout";
export const EXPORT_PATH = "/api/v3/workspace/export";

/** What the context headers carry; the room id travels in the requests the existing contract already defines. */
export type RequestContext = Pick<ProductionContext, "workspaceId" | "generation">;

export function buildHeaders(opts: { unsafe: boolean; context?: RequestContext | null; accept?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    accept: opts.accept ?? "application/json",
    [REQUEST_MARKER_HEADER]: "1",
  };
  if (opts.unsafe) headers["content-type"] = "application/json";
  if (opts.context) {
    headers[WORKSPACE_HEADER] = opts.context.workspaceId;
    headers[GENERATION_HEADER] = opts.context.generation;
  }
  return headers;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const PRODUCTION_CODES: ReadonlySet<string> = new Set<ProductionErrorCode>([
  "invalid_credentials",
  "unauthenticated",
  "forbidden",
  "not_found",
  "context_required",
  "recovery_required",
  "csrf_failed",
  "invalid_request",
  "payload_too_large",
  "rate_limited",
  "storage_unavailable",
  "authority_unavailable",
]);

export function isProductionCode(code: string | null): code is ProductionErrorCode {
  return code !== null && PRODUCTION_CODES.has(code);
}

/** The `{ error: { code, message } }` body of a production boundary error, or nulls. Domain receipts are not errors. */
export function readError(body: unknown): { code: string | null; message: string | null } {
  if (isRecord(body)) {
    if (isRecord(body.error)) {
      return {
        code: typeof body.error.code === "string" ? body.error.code : null,
        message: typeof body.error.message === "string" ? body.error.message : null,
      };
    }
    return { code: typeof body.code === "string" ? body.code : null, message: typeof body.message === "string" ? body.message : null };
  }
  return { code: null, message: null };
}

/** The code the server named; where it named none, only the statuses the contract fixes are inferred. */
export function classifyCode(status: number | null, body: unknown): string | null {
  const { code } = readError(body);
  if (code) return code;
  if (status === 401) return "unauthenticated";
  if (status === 503) return "authority_unavailable";
  return null;
}

export interface Fetched {
  ok: true;
  status: number;
  /** Parsed JSON, `null` for an empty body, `undefined` for a body that is present but is not JSON. */
  body: unknown;
  text: string;
  headers: Headers;
}

export interface FetchFailure {
  ok: false;
  kind: "network" | "timeout";
  message: string;
}

/**
 * One bounded same-origin request. The browser attaches the session cookie; this never throws, because transport
 * trouble is a value the caller must interpret (it is not proof that a command failed).
 */
export async function sendBounded(
  fetchImpl: typeof fetch | undefined,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Fetched | FetchFailure> {
  const doFetch = fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!doFetch) return { ok: false, kind: "network", message: "This browser cannot make network requests." };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FetchFailure>((resolve) => {
    timer = setTimeout(() => {
      resolve({ ok: false, kind: "timeout", message: "The server did not answer in time." });
      controller.abort();
    }, timeoutMs);
  });
  try {
    // Bound both headers and body, even if a fetch implementation ignores abort.
    return await Promise.race([(async (): Promise<Fetched> => {
      const res = await doFetch(url, { ...init, cache: "no-store", credentials: "same-origin", signal: controller.signal });
      const text = await res.text();
      let body: unknown = null;
      if (text !== "") {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = undefined;
        }
      }
      return { ok: true, status: res.status, body, text, headers: res.headers };
    })(), timeout]);
  } catch {
    return { ok: false, kind: "network", message: "The server could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}
