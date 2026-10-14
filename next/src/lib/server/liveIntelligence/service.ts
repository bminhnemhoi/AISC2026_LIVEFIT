import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { SessionSchema, type Session } from "@/contracts";
import { RefreshRequestSchema, type LiveIntelligenceSnapshot, type RefreshRequest } from "@/contracts/liveIntelligence";
import { reconcileLiveEvidence } from "@/lib/domain/liveIntelligence";
import { reconstructAsKnownThen } from "@/lib/domain/asKnownThen";
import type { RoomAuthority } from "../authority";
import { assertRoom } from "../authority";
import { AuthorityError, type Access } from "../config";
import { deployment } from "../database";
import { Limiter, readJson } from "../boundary";
import { canonicalJson } from "../validation";
import { intelligenceStatus, loadIntelligenceConfig, type IntelligenceEnv } from "./config";
import { IntelligenceProviderError, TikTokShopProvider } from "./provider";
import { fixtureCreatorMetrics, fixtureEvidence } from "./fixtures";
import { EvidenceStore, type EvidenceIdentity, type EvidenceScope, type RefreshResult } from "./store";

const refreshLimits = new Limiter();
const active = new Set<string>();
function identity(authority: RoomAuthority): EvidenceIdentity {
  return authority.production ? deployment(authority.db) : { workspaceId: `harness:${authority.roomId}`, generation: "phase2", roomId: authority.roomId };
}
function scope(authority: RoomAuthority, session: Session): EvidenceScope { return { ...identity(authority), sessionId: session.id, mode: session.environment }; }
function sessionFromRoom(authority: RoomAuthority, access: Access, sessionId: string): Session {
  const read = authority.read(access);
  if (!read.changed) throw new AuthorityError(503, "storage_unavailable", "Room state unavailable.");
  const session = read.sessions.find((s) => s.id === sessionId);
  if (!session) throw new AuthorityError(404, "not_found", "Show is not in this room.");
  return session;
}
export function statusFor(authority: RoomAuthority, authorityPath: string, env: IntelligenceEnv = process.env) {
  return intelligenceStatus(authorityPath, env);
}
export function latestEvidence(authority: RoomAuthority, authorityPath: string, session: Session, snapshotId?: string, env: IntelligenceEnv = process.env): LiveIntelligenceSnapshot | null {
  const { config, issues } = loadIntelligenceConfig(authorityPath, env);
  if (issues.includes("LIVELIFT_PROVIDER_EVIDENCE_DB_PATH")) throw new AuthorityError(503, "storage_unavailable", "Evidence storage is not configured safely.");
  if (!existsSync(config.dbPath)) return null;
  const store = new EvidenceStore(config.dbPath, identity(authority));
  try { return store.latest(scope(authority, session), snapshotId); } finally { store.close(); }
}

export async function refreshEvidence(request: Request, authority: RoomAuthority, access: Access, currentAccess: () => Access, authorityPath: string, env: IntelligenceEnv = process.env): Promise<RefreshResult & { duplicate: boolean }> {
  if (access.role !== "operator") throw new AuthorityError(403, "forbidden", "Operator access required.");
  const parsed = RefreshRequestSchema.safeParse(await readJson(request, 1_048_576));
  if (!parsed.success) throw new AuthorityError(400, "invalid_request", "Invalid provider refresh command.");
  const body = parsed.data;
  assertRoom(body.roomId, authority.roomId);
  const session = resolveSession(authority, access, body);
  const { config, issues } = loadIntelligenceConfig(authorityPath, env);
  if (issues.length || config.mode === "off") return { state: "NOT_CONFIGURED", code: "not_configured", duplicate: false };
  if ((session.environment === "REAL") !== (config.mode === "real")) return { state: "NOT_CONFIGURED", code: "not_configured", duplicate: false };
  if (session.environment === "REAL" && body.fixtureCase) throw new AuthorityError(400, "invalid_request", "Fixture evidence is restricted to SIMULATED rehearsals.");
  if (!body.providerSessionId && session.environment === "REAL") throw new AuthorityError(400, "invalid_request", "An explicit provider LIVE session mapping is required.");
  const providerSessionId = body.providerSessionId ?? BigInt(`0x${createHash("sha256").update(session.id).digest("hex").slice(0, 16)}`).toString();
  const s = scope(authority, session);
  const store = new EvidenceStore(config.dbPath, s);
  const activeKey = `${s.workspaceId}:${s.generation}:${s.roomId}`;
  const intent = createHash("sha256").update(canonicalJson(body)).digest("hex");
  const binding = createHash("sha256").update(canonicalJson({ mode: config.mode, appKey: config.appKey ?? "fixture", shop: config.shopCipher ?? "fixture" })).digest("hex");
  let claimed = false;
  try {
    const claim = store.claim(s, body.commandId, access.actorId, intent, Date.now(), () => {
      if (active.has(activeKey)) throw new AuthorityError(429, "rate_limited", "Another provider fetch is in progress.", 5);
      if (session.revision !== body.expectedSessionRevision) throw new AuthorityError(409, "stale_revision", "Show revision changed; read current evidence first.");
      if (body.action === "post_live" ? session.lifecycle !== "ended" || session.runtime.startedAtMs === null || session.runtime.endedAtMs === null : session.lifecycle !== "active") throw new AuthorityError(409, "invalid_state", body.action === "post_live" ? "Post-LIVE evidence requires a completed show." : "Creator snapshots require an active show.");
      if (new Set(body.productMappings.map((m) => m.liveLiftProductId)).size !== body.productMappings.length || new Set(body.productMappings.map((m) => m.providerProductId)).size !== body.productMappings.length || body.productMappings.some((m) => !session.products.some((p) => p.id === m.liveLiftProductId))) throw new AuthorityError(400, "invalid_request", "Product mappings must use unique stable identities in this show's pack.");
      refreshLimits.check(`intelligence:${s.workspaceId}:${s.roomId}`, 4, 60_000);
      store.bind(s, providerSessionId, binding);
    });
    if (claim.duplicate) return { ...claim.result!, duplicate: true };
    claimed = true;
    active.add(activeKey);
    try {
      const provider = new TikTokShopProvider(config);
      let result: RefreshResult;
      if (body.action === "creator_snapshot") {
        const metrics = config.mode === "fixture" ? fixtureCreatorMetrics(Date.now()) : await provider.getCreatorSnapshot(providerSessionId, Date.now());
        const recordedAt = Date.now();
        result = { state: "AVAILABLE", telemetry: { telemetryId: randomUUID(), sessionId: session.id, mode: session.environment, providerSessionId, observedAt: recordedAt, recordedAt,
          metrics: metrics.map((m) => ({ ...m, observedAt: recordedAt })) } };
      } else {
        const data = config.mode === "fixture" ? fixtureEvidence(session, Date.now(), body.fixtureCase) : {
          ...await provider.getMinuteEvidence(providerSessionId, Date.now()), productPerformance: await provider.getProductPerformance(providerSessionId, Date.now()),
          evidenceLimits: ["Seller analytics are post-LIVE observations; settlement latency is not guaranteed.", "Orders are provider SKU orders. Minute viewers are not additive unique viewers or concurrency.", ...(config.intervalPolicy === "unverified" ? ["Official minute end semantics unverified; conservative envelopes remain ambiguous."] : ["Half-open interval policy explicitly confirmed by deployment operator."])] };
        const fetchedAt = Date.now();
        data.minuteBuckets = data.minuteBuckets.map((b) => ({ ...b, observedAt: fetchedAt }));
        data.productPerformance = data.productPerformance.map((p) => ({ ...p, observedAt: fetchedAt }));
        result = { state: "AVAILABLE", snapshot: reconcileLiveEvidence(session, data, { snapshotId: randomUUID(), providerSessionId, fetchedAt, productMappings: body.productMappings }) };
      }
      // Recheck auth, workspace/generation and authoritative state AFTER slow upstream requests, before storing.
      const current = currentAccess();
      if (current.role !== "operator" || current.actorId !== access.actorId) throw new AuthorityError(403, "forbidden", "Operator access changed.");
      if (session.environment === "REAL") {
        const fresh = sessionFromRoom(authority, current, session.id);
        if (fresh.revision !== session.revision || fresh.lifecycle !== session.lifecycle) throw new AuthorityError(409, "stale_revision", "Show changed during provider fetch; reconcile again.");
      }
      if (result.state === "AVAILABLE" && result.telemetry) {
        // Creator responses have no observation timestamp. Record receipt on the authority's clock.
        const read = session.environment === "REAL" ? authority.read(current) : null;
        const recordedAt = read?.serverNowMs ?? session.virtualNowMs ?? Date.now();
        result.telemetry.recordedAt = recordedAt;
        result.telemetry.observedAt = recordedAt;
        result.telemetry.metrics = result.telemetry.metrics.map((m) => ({ ...m, observedAt: recordedAt }));
      }
      return { ...store.finish(s, body.commandId, result), duplicate: false };
    } finally { active.delete(activeKey); }
  } catch (error) {
    if (error instanceof AuthorityError) throw error;
    if (error instanceof IntelligenceProviderError) {
      if (claimed) {
        const current = currentAccess();
        if (current.role === "operator" && current.actorId === access.actorId) store.finish(s, body.commandId, error.failure);
      }
      return { ...error.failure, duplicate: false };
    }
    // Store failures escape to the existing safe authority boundary, never as upstream text.
    throw error;
  } finally { store.close(); }
}

function resolveSession(authority: RoomAuthority, access: Access, body: Pick<RefreshRequest, "sessionId" | "session">): Session {
  if (body.session !== undefined) {
    const parsed = SessionSchema.safeParse(body.session);
    if (!parsed.success || parsed.data.id !== body.sessionId || parsed.data.environment !== "SIMULATED") throw new AuthorityError(400, "invalid_request", "Only a validated SIMULATED rehearsal may be supplied by the browser.");
    return parsed.data;
  }
  return sessionFromRoom(authority, access, body.sessionId);
}

/** GET REAL by sessionId; POST SIMULATED read accepts its browser-local state under existing operator auth. */
export function readEvidence(authority: RoomAuthority, access: Access, authorityPath: string, input: {
  sessionId: string; roomId: string; session?: unknown; snapshotId?: string; perspective: "as_known_then" | "later_evidence"; asOfMs?: number;
}, env: IntelligenceEnv = process.env): unknown {
  assertRoom(input.roomId, authority.roomId);
  const session = resolveSession(authority, access, input);
  const { config, issues } = loadIntelligenceConfig(authorityPath, env);
  if (issues.includes("LIVELIFT_PROVIDER_EVIDENCE_DB_PATH")) throw new AuthorityError(503, "storage_unavailable", "Evidence storage is not configured safely.");
  const store = existsSync(config.dbPath) ? new EvidenceStore(config.dbPath, identity(authority)) : null;
  try {
    const s = scope(authority, session);
    if (input.perspective === "as_known_then") {
      if (input.asOfMs === undefined || session.runtime.startedAtMs === null || input.asOfMs < session.runtime.startedAtMs) throw new AuthorityError(400, "invalid_request", "Historical time must be at or after recorded LIVE start.");
      const replay = reconstructAsKnownThen(session, input.asOfMs);
      const cutoff = Math.min(input.asOfMs, session.runtime.endedAtMs ?? input.asOfMs);
      return { ...replay, providerEvidence: store?.knownTelemetry(s, cutoff).filter((e) => e.recordedAt >= session.runtime.startedAtMs! && e.observedAt >= session.runtime.startedAtMs!) ?? [] };
    }
    if (session.lifecycle !== "ended") throw new AuthorityError(409, "invalid_state", "Later evidence requires an ended show.");
    const snapshot = store?.latest(s, input.snapshotId) ?? null;
    if (input.snapshotId && !snapshot) throw new AuthorityError(404, "not_found", "Evidence snapshot not found for this show.");
    const storedState = store?.state(s);
    const state = storedState === "FETCHING" && !active.has(`${s.workspaceId}:${s.generation}:${s.roomId}`) ? "UNAVAILABLE" : storedState;
    const modeMatches = config.mode !== "off" && (session.environment === "REAL") === (config.mode === "real");
    return { sessionId: session.id, mode: session.environment, perspective: "later_evidence", snapshot,
      status: intelligenceStatus(authorityPath, env, modeMatches ? state : "NOT_CONFIGURED"), priorSnapshots: store?.history(s) ?? [] };
  } finally { store?.close(); }
}
