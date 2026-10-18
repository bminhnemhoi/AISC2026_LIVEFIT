import { constants, openSync, fstatSync, readFileSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { ProductionClient, type HttpResponse } from "./productionClient";
import type { AuthorityReceipt, CommandEnvelope, RoomRead } from "../src/contracts/authority";
import type { AuthSession } from "../src/contracts/production";
import type { Session } from "../src/contracts/session";

const exec = promisify(execFile);
const HELP = `LiveLift live-only soak (run from next/ after npm ci)
  npm run soak:smoke -- --duration 30s
  npm run soak:48h -- --duration 48h
  node acceptance/soak.mjs --mode smoke|rehearsal_48h --duration <positive integer>s|m|h
  node acceptance/soak.mjs --help
Required environment: LIVELIFT_TEST_SERVER_URL, LIVELIFT_WORKSPACE_ID, LIVELIFT_ROOM_ID,
  LIVELIFT_OPERATOR_USERNAME, LIVELIFT_OPERATOR_PASSWORD_FILE,
  LIVELIFT_VIEWER_USERNAME, LIVELIFT_VIEWER_PASSWORD_FILE.
Optional: LIVELIFT_APP_ORIGIN (defaults to URL origin), LIVELIFT_GENERATION (pin),
  NODE_EXTRA_CA_CERTS (private CA), LIVELIFT_SOAK_OPS_EXECUTABLE (trusted wrapper).
Passwords: owned regular files, mode 0600; one password, optional final newline.
Creates one REAL planned draft and edits only that draft. No show start/restore/delete.
Ctrl-C/SIGTERM prints STOPPED with exit 130/143; only completed runs report PASS.
`;

class SoakFailure extends Error {
  constructor(readonly code: string) { super(code); }
}

export function parseDuration(value: string): number {
  const match = /^([1-9]\d*)(s|m|h)$/.exec(value);
  const ms = match ? Number(match[1]) * ({ s: 1000, m: 60_000, h: 3_600_000 }[match[2]] ?? 0) : NaN;
  if (!Number.isSafeInteger(ms) || ms <= 0) throw new SoakFailure("invalid_duration");
  return ms;
}

export function parseSoakArgs(args: string[]) {
  let values;
  try {
    ({ values } = parseArgs({ args, options: {
      mode: { type: "string", multiple: true }, duration: { type: "string", multiple: true },
      help: { type: "boolean" },
    }, strict: true, allowPositionals: false }));
  } catch { throw new SoakFailure("invalid_arguments"); }
  if (values.help) return { help: true } as const;
  if ((values.mode?.length ?? 0) > 1 || (values.duration?.length ?? 0) > 1) throw new SoakFailure("duplicate_option");
  const mode = values.mode?.[0] ?? "smoke";
  if (mode !== "smoke" && mode !== "rehearsal_48h") throw new SoakFailure("invalid_mode");
  return {
    help: false, mode, durationMs: parseDuration(values.duration?.[0] ?? (mode === "smoke" ? "30s" : "48h")),
    pollIntervalMs: mode === "smoke" ? 1000 : 2000,
    commandIntervalMs: mode === "smoke" ? 5000 : 10_000,
    healthIntervalMs: mode === "smoke" ? 5000 : 30_000,
    reportIntervalMs: mode === "smoke" ? 5000 : 60_000,
  } as const;
}

type Options = Extract<ReturnType<typeof parseSoakArgs>, { help: false }>;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new SoakFailure(`missing_${name}`);
  return value;
}

export function readPasswordFile(path: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(fd);
    if (!info.isFile() || (info.mode & 0o777) !== 0o600 || info.uid !== process.getuid?.() || info.size > 513) {
      throw new Error();
    }
    const password = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(fd)).replace(/\n$/, "");
    if (password.includes("\n") || password.includes("\r") || password.length < 15 || password.length > 128) throw new Error();
    return password;
  } catch { throw new SoakFailure("invalid_protected_password_file"); }
  finally { if (fd !== undefined) closeSync(fd); }
}

function liveConfig(env: NodeJS.ProcessEnv) {
  let url: URL;
  let origin: URL;
  try {
    url = new URL(required(env, "LIVELIFT_TEST_SERVER_URL"));
    origin = new URL(env.LIVELIFT_APP_ORIGIN ?? url.origin);
    for (const input of [url, origin]) {
      if (!['https:', 'http:'].includes(input.protocol) || input.username || input.password || input.search || input.hash || input.pathname !== "/") throw new Error();
      if (input.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(input.hostname)) throw new Error();
    }
  } catch { throw new SoakFailure("invalid_live_url_or_origin"); }
  const workspaceId = required(env, "LIVELIFT_WORKSPACE_ID");
  const roomId = required(env, "LIVELIFT_ROOM_ID");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(workspaceId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(roomId) || (env.LIVELIFT_GENERATION && !uuid.test(env.LIVELIFT_GENERATION))) throw new SoakFailure("invalid_deployment_identity");
  const common = { baseUrl: url.origin, origin: origin.origin, workspaceId, roomId, requestTimeoutMs: 10_000 };
  const client = (role: "operator" | "viewer") => {
    const prefix = `LIVELIFT_${role.toUpperCase()}`;
    const username = required(env, `${prefix}_USERNAME`);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(username)) throw new SoakFailure("invalid_username");
    return new ProductionClient({ ...common, role, username, password: readPasswordFile(required(env, `${prefix}_PASSWORD_FILE`)) });
  };
  return { ...common, generation: env.LIVELIFT_GENERATION, operator: client("operator"), viewer: client("viewer"), ops: env.LIVELIFT_SOAK_OPS_EXECUTABLE };
}

/** Live HTTP only. No simulated fallback, snapshots or untrusted error text in output. */
export async function runSoakCli(args = process.argv.slice(2), env = process.env, write = (line: string) => process.stdout.write(line + "\n")): Promise<number> {
  let timer: ReturnType<typeof setInterval> | undefined;
  let signal: "SIGINT" | "SIGTERM" | undefined;
  const abort = new AbortController();
  const stopInt = () => { signal = "SIGINT"; abort.abort(); };
  const stopTerm = () => { signal = "SIGTERM"; abort.abort(); };
  const started = performance.now();
  const metrics = {
    loginsOperator: 0, loginsViewer: 0, sessionChecks: 0,
    pollsOperator: 0, pollsViewer: 0, commands: 0, commandAttempts: 0, committed: 0, rejected: 0,
    receipts: 0, reconciled: 0, duplicates: 0, reconnects: 0, errors: 0,
    lostAcksInjected: 0, readInterruptionsInjected: 0,
    health: 0, readiness: 0, statusChecks: 0, backups: 0, invariantChecks: 0, invariantViolations: 0,
  };
  let revision = -1;
  let generation: string | undefined;
  let failureCode: string | undefined;
  let options: Options | undefined;
  const summary = (event: string, result?: string) => write(JSON.stringify({ event, result, mode: options?.mode,
    elapsedMs: Math.round(performance.now() - started), configuredDurationMs: options?.durationMs,
    revision, generation, ...metrics, failureCode }));
  const invariant = (condition: unknown, code: string) => {
    metrics.invariantChecks++;
    if (!condition) { metrics.invariantViolations++; throw new SoakFailure(`invariant_${code}`); }
  };
  const pause = async (ms: number) => { await delay(ms, undefined, { signal: abort.signal }).catch(() => {}); };
  try {
    const parsed = parseSoakArgs(args);
    if (parsed.help) { write(HELP); return 0; }
    options = parsed;
    const config = liveConfig(env);
    const { operator, viewer } = config;
    write(JSON.stringify({ event: "startup", mode: options.mode, durationMs: options.durationMs,
      baseUrl: config.baseUrl, origin: config.origin, workspaceId: config.workspaceId, roomId: config.roomId,
      credentials: "[REDACTED]", opsChecks: Boolean(config.ops), viewers: 1,
      pollIntervalMs: options.pollIntervalMs, commandIntervalMs: options.commandIntervalMs,
      requestTimeoutMs: 10_000, recoveryBudgetMs: 300_000 }));
    process.on("SIGINT", stopInt);
    process.on("SIGTERM", stopTerm);
    timer = setInterval(() => summary("progress"), options.reportIntervalMs);
    generation = config.generation;
    const actors = new Map<ProductionClient, string>();
    const expires = new Map<ProductionClient, number>();
    // Retry only connectivity/transient availability. Auth/context failures fail closed.
    const request = async <T>(operation: () => Promise<HttpResponse<T>>, allowed = [200], client?: ProductionClient): Promise<HttpResponse<T>> => {
      const since = performance.now();
      let disconnected = false;
      for (;;) {
        const response = await operation();
        if (response.error?.code === "recovery_required") invariant(false, "generation_changed");
        if (response.status === 401 && client && Date.now() >= (expires.get(client) ?? Infinity)) {
          await login(client);
          continue;
        }
        if (allowed.includes(response.status)) {
          if (disconnected) metrics.reconnects++;
          return response;
        }
        metrics.errors++;
        if (![0, 429, 502, 503, 504].includes(response.status)) throw new SoakFailure("auth_or_server_failure");
        if (signal || performance.now() - since >= 300_000) throw new SoakFailure("connectivity_or_server_unrecovered");
        disconnected = true;
        // Bounded backoff honors Retry-After (including a date), capped at 30 seconds.
        const retry = response.headers.get("retry-after");
        const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 1000;
        await pause(Math.min(30_000, Math.max(1000, Number.isFinite(retryMs) ? retryMs : 1000)));
      }
    };
    const checkContext = (client: ProductionClient, session: AuthSession) => {
      invariant(session.workspaceId === config.workspaceId && session.roomId === config.roomId, "deployment_binding");
      invariant(typeof session.generation === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session.generation), "generation_shape");
      generation ??= session.generation;
      invariant(typeof generation === "string" && session.generation === generation, "generation_stability");
      invariant(session.access?.role === client.config.role && typeof session.access.actorId === "string", "authenticated_role");
      invariant(!actors.has(client) || actors.get(client) === session.access.actorId, "actor_stability");
      invariant(Number.isSafeInteger(session.expiresAtMs) && session.expiresAtMs > Date.now(), "session_expiry");
      actors.set(client, session.access.actorId);
      expires.set(client, session.expiresAtMs);
    };
    const login = async (client: ProductionClient) => {
      const response = await request(() => client.login());
      invariant(response.data && client.getSessionCookie(), "login_cookie");
      checkContext(client, response.data!);
      if (client === operator) metrics.loginsOperator++; else metrics.loginsViewer++;
    };
    const authenticate = async (client: ProductionClient) => {
      // Frozen sessions never silently renew: explicitly logout/login near absolute expiry.
      if (Date.now() >= (expires.get(client) ?? 0) - 60_000) {
        await request(() => client.logout(), [200, 401]);
        await login(client);
      }
    };
    await login(operator);
    await login(viewer);
    const latest = new Map<string, Session>();
    let cachedRevision = -1;
    let cachedSnapshot = "";
    let draftId: string | null = null;
    const poll = async (client: ProductionClient): Promise<RoomRead> => {
      await authenticate(client);
      const response = await request(() => client.pollRoom(undefined, undefined, config.roomId), [200], client);
      const room = response.data!;
      invariant(room && room.roomId === config.roomId && room.changed === true && Array.isArray(room.sessions), "room_snapshot");
      invariant(room.access?.role === client.config.role && room.access.actorId === actors.get(client), "read_identity");
      invariant(Number.isSafeInteger(room.revision) && room.revision >= revision, "revision_monotonicity");
      if (!room.changed) throw new SoakFailure("invariant_full_snapshot_required");
      const snapshot = JSON.stringify(room.sessions);
      invariant(cachedRevision !== room.revision || cachedSnapshot === snapshot, "operator_viewer_divergence");
      invariant(new Set(room.sessions.map(s => s.id)).size === room.sessions.length, "unique_sessions");
      invariant(room.sessions.filter(s => s.lifecycle === "active").length <= 1, "single_active_show");
      for (const session of room.sessions) {
        invariant(session.environment === "REAL" && session.virtualNowMs === null, "real_authority");
        invariant(Number.isSafeInteger(session.revision) && session.revision >= 0 && Array.isArray(session.events) && session.plans?.length > 0, "session_shape");
        const previous = latest.get(session.id);
        invariant(!previous || session.revision >= previous.revision, "session_revision");
        invariant(!previous || JSON.stringify(session.events.slice(0, previous.events.length)) === JSON.stringify(previous.events), "append_only_history");
        invariant(session.events.every((e, i) => e.source === "operator" && Number.isSafeInteger(e.seq) && e.seq > (i === 0 ? 0 : session.events[i - 1].seq)), "event_order_and_source");
      }
      invariant([...latest.keys()].every(id => room.sessions.some(s => s.id === id)), "session_retention");
      revision = room.revision;
      cachedRevision = room.revision;
      cachedSnapshot = snapshot;
      for (const session of room.sessions) latest.set(session.id, session);
      if (client === operator) metrics.pollsOperator++; else metrics.pollsViewer++;
      return room;
    };
    const command = async () => {
      await poll(operator);
      const commandId = randomUUID();
      const title = `Release soak ${runId} ${metrics.commands % 2 === 0 ? "A" : "B"}`;
      const draft = draftId ? latest.get(draftId) : undefined;
      if (draftId) invariant(draft?.lifecycle === "planned" && !draft.baselineLocked, "owned_draft_editable");
      const envelope: CommandEnvelope = draft ? {
        commandId, roomId: config.roomId, sessionId: draft.id, expectedRevision: revision, type: "save_prepare",
        payload: { title, timezone: draft.timezone, objective: draft.objective, accountLabel: draft.accountLabel,
          products: draft.products, plannedStartMs: draft.plans[0].plannedStartMs,
          segments: draft.plans[0].segments, cues: draft.plans[0].cues },
      } : { commandId, roomId: config.roomId, sessionId: null, expectedRevision: revision, type: "create_session",
        payload: { title, timezone: "UTC", plannedStartMs: Date.now() + 3_600_000 } };
      metrics.commands++;
      const loseAck = (metrics.commands - 1) % 5 === 0;
      if (loseAck) metrics.lostAcksInjected++;
      const send = async () => {
        metrics.commandAttempts++;
        let response = await operator.sendCommand(envelope);
        if (response.status === 401 && Date.now() >= (expires.get(operator) ?? Infinity)) {
          await login(operator);
          metrics.commandAttempts++;
          response = await operator.sendCommand(envelope);
        }
        if (response.error?.code === "recovery_required") invariant(false, "generation_changed");
        if (![0, 200, 409, 422, 429, 502, 503, 504].includes(response.status)) throw new SoakFailure("auth_or_server_failure");
        if ([0, 429, 502, 503, 504].includes(response.status)) metrics.errors++;
        return response;
      };
      let acknowledgement = await send();
      const unknownAck = acknowledgement.status === 0;
      const receiptResponse = await request(async () => {
        // UNKNOWN after any lost response: lookup first, resend the identical envelope only if absent.
        const lookup = await operator.getReceipt(commandId, undefined, config.roomId);
        if (lookup.status !== 404) return lookup;
        acknowledgement = await send();
        if ([0, 429, 502, 503, 504].includes(acknowledgement.status)) return { ...lookup, status: acknowledgement.status };
        return operator.getReceipt(commandId, undefined, config.roomId);
      }, [200], operator);
      const receipt = receiptResponse.data as AuthorityReceipt;
      metrics.receipts++;
      if (loseAck || unknownAck) metrics.reconciled++;
      if (unknownAck) metrics.reconnects++;
      invariant(receipt && receipt.commandId === commandId && receipt.type === envelope.type, "receipt_identity");
      invariant(Number.isSafeInteger(receipt.roomRevisionAfter) && receipt.roomRevisionAfter >= envelope.expectedRevision, "receipt_revision");
      if (!loseAck && acknowledgement.data) invariant(JSON.stringify(acknowledgement.data.receipt) === JSON.stringify(receipt), "durable_receipt");
      if (receipt.outcome === "committed") {
        invariant(receipt.roomRevisionAfter === envelope.expectedRevision + 1 && receipt.sessionId && Number.isSafeInteger(receipt.sessionRevisionAfter), "atomic_commit");
        metrics.committed++;
        draftId = receipt.sessionId;
      } else {
        metrics.rejected++;
        invariant(receipt.outcome === "rejected" && receipt.code === "stale_revision", "unexpected_command_rejection");
      }
      if (loseAck) {
        // Replay the exact intent after receipt lookup; it must not advance authority twice.
        const duplicate = await request(send, [200, 409], operator);
        let body = duplicate.data;
        if (!body && duplicate.rawText) { try { body = JSON.parse(duplicate.rawText); } catch { /* invariant below */ } }
        invariant(body?.duplicate === true && JSON.stringify(body.receipt) === JSON.stringify(receipt), "idempotent_replay");
        metrics.duplicates++;
      }
      revision = Math.max(revision, receipt.roomRevisionAfter);
      await poll(operator);
      await poll(viewer);
      if (receipt.outcome === "committed") invariant(latest.get(draftId!)?.revision === receipt.sessionRevisionAfter && latest.get(draftId!)?.title === title, "mutation_visible");
    };
    const opsCheck = async (backup: boolean) => {
      if (!config.ops) return;
      try {
        const result = await exec(config.ops, ["status", "--json"], { timeout: 60_000, maxBuffer: 64 * 1024 });
        const status = JSON.parse(result.stdout);
        invariant(status.ready === true && status.integrity === "ok" && status.schemaVersion === 2 && status.maintenance === false, "ops_readiness");
        invariant(status.context?.workspaceId === config.workspaceId && status.context?.roomId === config.roomId && status.context?.generation === generation, "ops_context");
        invariant(Number.isSafeInteger(status.roomRevision) && status.roomRevision >= revision, "ops_revision");
        metrics.statusChecks++;
        if (backup) {
          // Existing ops backup independently validates checksum, schema and SQLite integrity before exit 0.
          await exec(config.ops, ["backup"], { timeout: 60_000, maxBuffer: 64 * 1024 });
          metrics.backups++;
        }
      } catch (error) {
        if (error instanceof SoakFailure) throw error;
        throw new SoakFailure("ops_status_or_backup_failed");
      }
    };
    const runId = randomUUID();
    let lastCommand = -Infinity, lastPoll = -Infinity, lastHealth = -Infinity, lastBackup = -Infinity;
    let cycles = 0;
    while (!signal && performance.now() - started < options.durationMs) {
      const now = performance.now();
      if (now - lastHealth >= options.healthIntervalMs) {
        const health = await request(() => operator.getHealthz());
        invariant(health.data?.live === true, "health_probe"); metrics.health++;
        const ready = await request(() => operator.getReadyz());
        invariant(ready.data?.ready === true, "readiness_probe"); metrics.readiness++;
        for (const client of [operator, viewer]) {
          await authenticate(client);
          const session = await request(() => client.getSession(), [200], client);
          checkContext(client, session.data!); metrics.sessionChecks++;
        }
        const backup = now - lastBackup >= 3_600_000;
        await opsCheck(backup);
        if (backup) lastBackup = now;
        lastHealth = now;
      }
      if (signal) break;
      if (now - lastPoll >= options.pollIntervalMs) {
        await poll(operator);
        // Safely inject a client-side read interruption, then recover through a fresh authenticated poll.
        if (cycles++ % 10 === 0) {
          const lostRead = await viewer.rawRequest("/api/v3/room", { headers: viewer.getHeaders({ includeCsrf: false }), signal: AbortSignal.abort() });
          invariant(lostRead.status === 0, "injected_read_interruption");
          metrics.readInterruptionsInjected++;
          metrics.reconnects++;
        }
        await poll(viewer);
        lastPoll = now;
      }
      if (signal) break;
      if (now - lastCommand >= options.commandIntervalMs) { await command(); lastCommand = now; }
      await pause(Math.min(250, Math.max(1, options.durationMs - (performance.now() - started))));
    }
    if (!signal) {
      await poll(operator); await poll(viewer);
      const ready = await request(() => operator.getReadyz());
      invariant(ready.data?.ready === true, "readiness_probe"); metrics.readiness++;
      invariant(metrics.loginsOperator > 0 && metrics.loginsViewer > 0 && metrics.pollsOperator > 0 && metrics.pollsViewer > 0 && metrics.committed > 0, "live_activity");
      invariant(metrics.commands === metrics.committed + metrics.rejected && metrics.receipts === metrics.commands, "receipt_accounting");
    }
    summary("final", signal ? "STOPPED" : "PASS");
    return signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 0;
  } catch (error) {
    failureCode = error instanceof SoakFailure ? error.code : "invalid_live_response_or_tooling_failure";
    metrics.errors++;
    summary("final", "FAIL");
    return 1;
  } finally {
    if (timer) clearInterval(timer);
    process.off("SIGINT", stopInt);
    process.off("SIGTERM", stopTerm);
  }
}
