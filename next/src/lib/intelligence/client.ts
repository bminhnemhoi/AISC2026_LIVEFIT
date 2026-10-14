import type { Session } from "@/contracts";
import { INTELLIGENCE_ROUTES, ProviderStatusSchema, HistoricalEvidenceSchema, type HistoricalEvidence, RefreshRequestSchema, type ProviderCapability, type ProviderStatus, type RefreshRequest } from "@/contracts/liveIntelligence";
import { buildHeaders, readError, sendBounded, type Fetched, type FetchFailure, type RequestContext } from "@/lib/client/productionTransport";
import { parseSnapshot } from "./parse";
import type { LiveIntelligenceResult } from "./types";
export { INTELLIGENCE_ROUTES } from "@/contracts/liveIntelligence";

export type EvidenceTarget = { roomId: string; sessionId: string; environment: Session["environment"]; session?: Session; snapshotId?: string };
export type CapabilitiesResult = { kind: "ok"; capabilities: ProviderCapability[]; status: ProviderStatus } | { kind: "signed_out" | "not_configured" } | { kind: "unavailable"; message: string };
export interface LiveIntelligenceClient {
  getSnapshot(context: RequestContext, target: EvidenceTarget): Promise<LiveIntelligenceResult>;
  requestRefresh(context: RequestContext, command: RefreshRequest, environment: Session["environment"]): Promise<LiveIntelligenceResult>;
  getCapabilities(context: RequestContext): Promise<CapabilitiesResult>;
  getHistorical(context: RequestContext, target: EvidenceTarget, asOfMs: number): Promise<HistoricalEvidence | null>;
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Translate the server's read/status or refresh envelope; snapshot values stay in the shared contract. */
export function interpretSnapshotResponse(res: Fetched | FetchFailure, sessionId: string, environment: Session["environment"] = "REAL"): LiveIntelligenceResult {
  if (!res.ok) return { kind: "unavailable", reason: res.kind, message: res.message };
  const { status, body } = res;
  if (status === 401) return { kind: "signed_out" };
  if (status === 403) return { kind: "forbidden" };
  if (status === 429) return { kind: "rate_limited", retryAfterSec: Number(res.headers?.get("retry-after")) || null };
  if (status < 200 || status >= 300) return { kind: "unavailable", reason: status === 404 ? "not_found" : "server", message: readError(body).message ?? `The server answered ${status}.` };
  if (!isRecord(body)) return { kind: "unavailable", reason: "malformed", message: "The server sent evidence LiveLift could not read." };
  const state = isRecord(body.status) ? body.status.state : body.state;
  // A failed refresh must not masquerade as an available result just because an older snapshot exists.
  if (body.snapshot == null || body.state !== undefined && body.state !== "AVAILABLE" || isRecord(body.status) && !["READY", "AVAILABLE"].includes(String(state))) {
    switch (state) {
      case "NOT_CONFIGURED": return { kind: "not_configured" };
      case "ACCESS_NOT_GRANTED": return { kind: "access_not_granted" };
      case "AUTH_EXPIRED": return { kind: "auth_expired" };
      case "RATE_LIMITED": return { kind: "rate_limited", retryAfterSec: typeof body.retryAfterSec === "number" ? body.retryAfterSec : null };
      case "UNSUPPORTED": return { kind: "unsupported" };
      case "FETCHING": return { kind: "fetching" };
      case "READY": return { kind: "unavailable", reason: "not_found", message: "No later evidence has been fetched for this show. An operator can fetch it using its provider LIVE session ID." };
      default: return { kind: "unavailable", reason: "server", message: "Provider evidence is unavailable. Show performance is unknown, not zero." };
    }
  }
  const raw = body.snapshot;
  // Reject wrong environment before parsing: even malformed fixture payloads cannot enter a REAL view.
  if (environment === "REAL" && isRecord(raw) && (typeof raw.provider === "string" && /fixture/i.test(raw.provider) || raw.mode === "SIMULATED" || raw.fixture === true)) return { kind: "unavailable", reason: "rejected_fixture", message: "The server sent fixture or SIMULATED evidence for a REAL show. LiveLift discarded it." };
  const parsed = parseSnapshot(raw);
  if (!parsed.ok) return { kind: "unavailable", reason: parsed.reason, message: "The server sent evidence LiveLift could not trust, so it was not shown." };
  if (parsed.snapshot.sessionId !== sessionId || parsed.snapshot.mode !== environment) return { kind: "unavailable", reason: "session_mismatch", message: "The evidence belongs to a different show or environment, so LiveLift discarded it." };
  return { kind: "available", snapshot: parsed.snapshot, origin: parsed.origin };
}

export function createLiveIntelligenceClient(options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): LiveIntelligenceClient {
  const send = (url: string, init: RequestInit) => sendBounded(options.fetchImpl, url, init, options.timeoutMs ?? 30_000);
  return {
    getHistorical: async (context, target, asOfMs) => {
      const input = { roomId: target.roomId, sessionId: target.sessionId, perspective: "as_known_then", asOfMs };
      const res = await send(target.environment === "SIMULATED" ? INTELLIGENCE_ROUTES.evidence : `${INTELLIGENCE_ROUTES.evidence}?${new URLSearchParams({ ...input, asOfMs: String(asOfMs) })}`, {
        method: target.environment === "SIMULATED" ? "POST" : "GET", headers: buildHeaders({ unsafe: target.environment === "SIMULATED", context }),
        ...(target.environment === "SIMULATED" ? { body: JSON.stringify({ ...input, session: target.session }) } : {}),
      });
      if (!res.ok || res.status !== 200) return null;
      const parsed = HistoricalEvidenceSchema.safeParse(res.body);
      if (!parsed.success || parsed.data.sessionId !== target.sessionId || parsed.data.mode !== target.environment || parsed.data.asOfMs !== asOfMs) return null;
      const cutoff = Math.min(asOfMs, parsed.data.runtime.endedAtMs ?? asOfMs);
      if (parsed.data.events.some(e => e.recordedAtMs > cutoff) || parsed.data.providerEvidence.some(e => e.sessionId !== target.sessionId || e.mode !== target.environment || e.recordedAt > cutoff || e.observedAt > cutoff || e.metrics.some(m => m.observedAt > cutoff))) return null;
      return parsed.data;
    },
    getSnapshot: async (context, target) => {
      const { environment, ...input } = target;
      if (environment === "REAL" && input.session) return { kind: "unavailable", reason: "rejected_fixture", message: "REAL evidence is read from the authority by identity only." };
      const query = new URLSearchParams({ roomId: input.roomId, sessionId: input.sessionId, perspective: "later_evidence", ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}) });
      const res = await send(environment === "SIMULATED" ? INTELLIGENCE_ROUTES.evidence : `${INTELLIGENCE_ROUTES.evidence}?${query}`, {
        method: environment === "SIMULATED" ? "POST" : "GET", headers: buildHeaders({ unsafe: environment === "SIMULATED", context }),
        ...(environment === "SIMULATED" ? { body: JSON.stringify({ ...input, perspective: "later_evidence" }) } : {}),
      });
      return interpretSnapshotResponse(res, input.sessionId, environment);
    },
    requestRefresh: async (context, command, environment) => {
      const parsed = RefreshRequestSchema.safeParse(command);
      if (!parsed.success || environment === "REAL" && (command.session || command.fixtureCase)) return { kind: "unavailable", reason: "malformed", message: "The provider refresh command is invalid." };
      return interpretSnapshotResponse(await send(INTELLIGENCE_ROUTES.refresh, { method: "POST", headers: buildHeaders({ unsafe: true, context }), body: JSON.stringify(parsed.data) }), command.sessionId, environment);
    },
    getCapabilities: async context => {
      const res = await send(INTELLIGENCE_ROUTES.status, { method: "GET", headers: buildHeaders({ unsafe: false, context }) });
      if (!res.ok) return { kind: "unavailable", message: res.message };
      if (res.status === 401) return { kind: "signed_out" };
      if (res.status >= 200 && res.status < 300 && isRecord(res.body) && Array.isArray(res.body.capabilities)) {
        // Keys/states are rendered conservatively by buildLedger; unknown answers never become available.
        const parsed = ProviderStatusSchema.safeParse(res.body);
        if (parsed.success) return { kind: "ok", capabilities: parsed.data.capabilities, status: parsed.data };
      }
      return { kind: "unavailable", message: "The server sent a capability list LiveLift could not read." };
    },
  };
}
