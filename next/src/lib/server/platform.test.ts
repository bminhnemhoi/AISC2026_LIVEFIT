// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, appendFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { newSegment } from "@/lib/domain/plan";
import { RoomAuthority } from "./authority";
import { authenticate, type ProductionConfig } from "./config";
import { initialize, migrateInstallation, deleteWorkspace, status } from "./operations";
import { currentSession, login, addUser, updateUser, COOKIE, SESSION_MS, passwordHash } from "./auth";
import { deployment, migrateV1, openExisting, schemaVersion, verifyDatabase, exportWorkspace } from "./database";
import { createBackup, validateArtifact, restoreBackup } from "./backup";
import { checkContext, csrf, readJson, Limiter } from "./boundary";
import { closeRuntime, getRuntime, ready } from "./runtime";
import { installationLock, markerPath, assertNotRetired, durableJson } from "./lifecycle";
import { log } from "./log";
import { POST as loginRoute } from "@/app/api/v3/auth/login/route";
import { GET as sessionRoute } from "@/app/api/v3/auth/session/route";
import { POST as logoutRoute } from "@/app/api/v3/auth/logout/route";
import { POST as commands } from "@/app/api/v3/room/commands/route";
import { GET as room } from "@/app/api/v3/room/route";
import { GET as health } from "@/app/api/healthz/route";
import { GET as readiness } from "@/app/api/readyz/route";
import { GET as exportRoute } from "@/app/api/v3/workspace/export/route";
import { GET as receiptRoute } from "@/app/api/v3/room/commands/[commandId]/route";

const folders: string[] = [];
function config(): ProductionConfig {
  const folder = mkdtempSync(join(tmpdir(), "livelift-platform-")); folders.push(folder);
  return { dbPath: join(folder, "authority.sqlite"), backupDir: join(folder, "backups"), roomId: "studio", workspaceId: randomUUID(), origin: "https://livelift.example.com", trustProxy: false, capabilities: [] };
}
function production(config: ProductionConfig): void {
  for (const [key, value] of Object.entries({ NODE_ENV: "production", LIVELIFT_WORKSPACE_ID: config.workspaceId, LIVELIFT_ROOM_ID: config.roomId, LIVELIFT_APP_ORIGIN: config.origin, LIVELIFT_DB_PATH: config.dbPath, LIVELIFT_BACKUP_DIR: config.backupDir })) vi.stubEnv(key, value);
}
function request(path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`https://livelift.example.com${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", Origin: "https://livelift.example.com", "X-LiveLift-Request": "1", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function headers(token: string, context?: { workspaceId: string; generation: string }): Record<string, string> {
  return { Cookie: `${COOKIE}=${token}`, ...(context ? { "X-LiveLift-Workspace": context.workspaceId, "X-LiveLift-Generation": context.generation } : {}) };
}
afterEach(async () => { await closeRuntime(); vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });

test.each(["development", "production"])("session resolves 401 behind an HTTPS tunnel in %s; forwarded headers cannot bypass CSRF", async (mode) => {
  const cfg = config(); initialize(cfg); production(cfg);
  vi.stubEnv("NODE_ENV", mode);
  const tunnelHeaders = { Host: "livelift.example.com", "X-Forwarded-Host": "livelift.example.com", "X-Forwarded-Proto": "https", "CF-Visitor": '{"scheme":"https"}' };
  const response = await sessionRoute(new Request("http://localhost:3130/api/v3/auth/session", { headers: tunnelHeaders }));
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: "unauthenticated" } });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.has("Set-Cookie")).toBe(false);
  expect(() => csrf(request("/api/v3/auth/login", {}, tunnelHeaders), cfg)).not.toThrow();
  for (const Origin of ["https://other.example.com", "http://livelift.example.com", "https://livelift.example.com:8443", "null", ""]) {
    expect(() => csrf(request("/api/v3/auth/login", {}, { ...tunnelHeaders, Origin }), cfg)).toThrow("Same-origin");
  }
}, 2000);

test("session reports unavailable storage rather than signed out and never creates a missing database", async () => {
  const cfg = config(); production(cfg);
  const response = await sessionRoute(request("/api/v3/auth/session"));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: "storage_unavailable" } });
  expect(existsSync(cfg.dbPath)).toBe(false);
}, 2000);

test("cookie HTTP login/logout, current auth, context, role, CSRF, expiry, export and duplicate protection", async () => {
  const cfg = config(); initialize(cfg);
  const db = openExisting(cfg.dbPath);
  const password = "  long pass word preserved  ";
  await addUser(db, "operator", "Lead", "operator", password);
  await addUser(db, "viewer", "Watch", "viewer", password);
  production(cfg);
  expect(() => authenticate(request("/api/v3/room", undefined, { Authorization: "Bearer test" }), { ...cfg, capabilities: [{ token: "test", roomId: cfg.roomId, actorId: "forged", role: "operator", name: "Forged" }] })).toThrow("current login session");
  expect((await room(request("/api/v3/room", undefined, { Authorization: "Bearer test" }))).status).toBe(401);
  expect((await health(request("/api/healthz"))).status).toBe(200);
  expect((await readiness(request("/api/readyz"))).status).toBe(200);
  expect((await loginRoute(request("/api/v3/auth/login", { username: "missing", password }))).status).toBe(401);
  const response = await loginRoute(request("/api/v3/auth/login", { username: "operator", password }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[\w-]+$/);
  const setCookie = response.headers.get("Set-Cookie")!;
  for (const attribute of ["Secure", "HttpOnly", "SameSite=Strict", "Path=/"]) expect(setCookie).toContain(attribute);
  expect(setCookie).not.toContain("Domain");
  const token = setCookie.split(";")[0].split("=")[1];
  expect(Buffer.from(token, "base64url").length).toBe(32);
  const session = await response.json();
  expect(session.expiresAtMs - Date.now()).toBeGreaterThan(SESSION_MS - 10000);
  expect(db.prepare("SELECT token_hash FROM login_sessions").get()!.token_hash).not.toBe(token);
  const auth = headers(token, session);
  const sessionRead = await sessionRoute(request("/api/v3/auth/session", undefined, headers(token)));
  expect(sessionRead.status).toBe(200);
  expect(sessionRead.headers.has("Set-Cookie")).toBe(false);
  expect((await sessionRead.json()).expiresAtMs).toBe(session.expiresAtMs);
  expect((await room(request("/api/v3/room", undefined, headers(token)))).status).toBe(400);
  expect((await room(request("/api/v3/room", undefined, { ...auth, "X-LiveLift-Workspace": randomUUID() }))).status).toBe(404);
  expect((await room(request("/api/v3/room", undefined, { ...auth, "X-LiveLift-Generation": randomUUID() }))).status).toBe(409);
  expect((await room(request("/api/v3/room?roomId=wrong", undefined, auth))).status).toBe(404);
  const envelope = { commandId: "first", roomId: cfg.roomId, sessionId: null, expectedRevision: 0, type: "create_session", payload: { title: "Show", timezone: "UTC", plannedStartMs: Date.now() } };
  for (const override of ([{ Origin: "" }, { Origin: "null" }, { Origin: "https://wrong.example" }, { "X-LiveLift-Request": "" }, { "Content-Type": "text/plain" }] as Record<string, string>[])) {
    expect((await commands(request("/api/v3/room/commands", envelope, { ...auth, ...override }))).status).toBe(403);
  }
  expect((await commands(request("/api/v3/room/commands", { ...envelope, roomId: "wrong" }, auth))).status).toBe(404);
  expect(db.prepare("SELECT 1 FROM command_log WHERE command_id = ?").get(envelope.commandId)).toBeUndefined();
  expect((await commands(request("/api/v3/room/commands", envelope, auth))).status).toBe(200);
  const duplicate = await commands(request("/api/v3/room/commands", envelope, auth));
  expect((await duplicate.json()).duplicate).toBe(true);
  const exported = await exportRoute(request("/api/v3/workspace/export", undefined, auth));
  const output = await exported.json();
  expect(output.snapshot.sessions[0].environment).toBe("REAL");
  expect(output.receipts[0].actorId).toBe(session.access.actorId);
  expect(JSON.stringify(output)).not.toMatch(/password_hash|token_hash|salt|SIMULATED/);
  const viewer = await login(db, "viewer", password);
  expect((await commands(request("/api/v3/room/commands", envelope, headers(viewer.token, viewer.session)))).status).toBe(403);
  expect((await exportRoute(request("/api/v3/workspace/export", undefined, headers(viewer.token, viewer.session)))).status).toBe(403);
  const generationError = await receiptRoute(request("/api/v3/room/commands/first", undefined, { ...auth, "X-LiveLift-Generation": randomUUID() }), { params: Promise.resolve({ commandId: "first" }) });
  expect(generationError.status).toBe(409);
  let releaseBody: () => void = () => {};
  const delayedBody = new ReadableStream<Uint8Array>({ start(controller) {
    releaseBody = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify(envelope))); controller.close(); };
  } });
  const pending = commands(new Request("https://livelift.example.com/api/v3/room/commands", { method: "POST", headers: { ...auth, Origin: cfg.origin, "Content-Type": "application/json", "X-LiveLift-Request": "1" }, body: delayedBody, duplex: "half" } as RequestInit));
  await new Promise((resolve) => setTimeout(resolve, 10));
  await updateUser(db, "operator", "set-role", "viewer");
  releaseBody(); expect((await pending).status).toBe(401);
  expect((await commands(request("/api/v3/room/commands", envelope, auth))).status).toBe(401);
  const renewed = await login(db, "operator", password);
  expect(renewed.session.access.role).toBe("viewer");
  expect(() => currentSession(db, request("/", undefined, headers(renewed.token)), renewed.session.expiresAtMs)).toThrow("current login session");
  await updateUser(db, "operator", "reset-password", "replacement password  ");
  expect(() => currentSession(db, request("/", undefined, headers(renewed.token)))).toThrow();
  await expect(login(db, "operator", password)).rejects.toThrow("Invalid username");
  const newLogin = await login(db, "operator", "replacement password  ");
  expect((await logoutRoute(request("/api/v3/auth/logout", {}, headers(newLogin.token)))).status).toBe(200);
  expect(() => currentSession(db, request("/", undefined, headers(newLogin.token)))).toThrow();
  await updateUser(db, "viewer", "disable");
  expect(() => currentSession(db, request("/", undefined, headers(viewer.token)))).toThrow();
  await expect(login(db, "viewer", password)).rejects.toThrow();
  await updateUser(db, "operator", "delete");
  expect(db.prepare("SELECT actor_id FROM command_log WHERE command_id='first'").get()!.actor_id).toBe(session.access.actorId);
  expect(() => db.prepare("DELETE FROM actor_ids WHERE actor_id = ?").run(session.access.actorId)).toThrow("never reused");
  db.close();
}, 60000);

test("v1 migration preserves authority, rejects unknown versions, rolls back failures, and startup fails closed", async () => {
  const cfg = config();
  vi.stubEnv("NODE_ENV", "test");
  const authority = new RoomAuthority(cfg.roomId, cfg.dbPath);
  const op = { actorId: "phase2-actor", name: "Lead", role: "operator" as const };
  const command = { commandId: "migration-create", roomId: cfg.roomId, sessionId: null, expectedRevision: 0, type: "create_session", payload: { title: "Existing", timezone: "UTC", plannedStartMs: Date.now() } };
  const result = authority.command(command, op);
  authority.close();
  await migrateInstallation(cfg, "test-commit");
  const db = openExisting(cfg.dbPath);
  expect(schemaVersion(db)).toBe(2); verifyDatabase(db, cfg);
  expect(JSON.parse(String(db.prepare("SELECT receipt_json FROM command_log").get()!.receipt_json))).toEqual(result.body.receipt);
  expect(db.prepare("SELECT 1 FROM actor_ids WHERE actor_id = ?").get(op.actorId)).toBeTruthy();
  production(cfg);
  expect(() => new RoomAuthority(cfg.roomId, cfg.dbPath)).toThrow("Production identity");
  expect(() => new RoomAuthority(cfg.roomId, cfg.dbPath, { ...cfg, workspaceId: randomUUID() })).toThrow("identity mismatch");
  db.exec("PRAGMA user_version = 99");
  expect(() => new RoomAuthority(cfg.roomId, cfg.dbPath, cfg)).toThrow("Unsupported schema");
  db.close();
  const v1Artifact = join(cfg.backupDir, readdirSync(cfg.backupDir).find((name) => name.startsWith("backup-"))!);
  await restoreBackup(v1Artifact, cfg);
  const forwarded = openExisting(cfg.dbPath);
  expect(schemaVersion(forwarded)).toBe(2); verifyDatabase(forwarded, cfg); forwarded.close();
  const missing = config(); production(missing);
  expect(() => new RoomAuthority(missing.roomId, missing.dbPath, missing)).toThrow("missing");
  expect(existsSync(missing.dbPath)).toBe(false);
  expect((await readiness(request("/api/readyz"))).status).toBe(503);
  expect((await health(request("/api/healthz"))).status).toBe(200);
  const broken = config(); vi.stubEnv("NODE_ENV", "test");
  const seed = new RoomAuthority(broken.roomId, broken.dbPath); seed.close();
  const failure = openExisting(broken.dbPath);
  failure.exec("CREATE TABLE deployment (injected TEXT)");
  expect(() => migrateV1(failure, broken)).toThrow();
  expect(schemaVersion(failure)).toBe(1);
  expect(failure.prepare("SELECT name FROM sqlite_master WHERE name = 'accounts'").get()).toBeUndefined();
  failure.close();
  await expect(migrateInstallation(broken, "test")).rejects.toThrow();
  expect(existsSync(markerPath(broken))).toBe(true);
});

test("verified backup, restore generation/revocation, staged failures, deletion and retirement", async () => {
  const cfg = config(); initialize(cfg);
  const db = openExisting(cfg.dbPath);
  const actor = await addUser(db, "restore-user", "Lead", "operator", "long backup password");
  const signed = await login(db, "restore-user", "long backup password");
  const authority = new RoomAuthority(cfg.roomId, cfg.dbPath, cfg);
  authority.command({ commandId: "backed-up", roomId: cfg.roomId, sessionId: null, expectedRevision: 0, type: "create_session", payload: { title: "Preserved", timezone: "UTC", plannedStartMs: Date.now(), segments: [newSegment("backup-opening", { title: "Opening", kind: "opening", targetSec: 60, minSec: 0 })] } }, signed.session.access);
  const before = exportWorkspace(db);
  const artifact = await createBackup(db, cfg, "test-commit");
  const manifest = await validateArtifact(artifact, cfg);
  expect(manifest).toMatchObject({ schemaVersion: 2, roomRevision: 1, workspaceId: cfg.workspaceId, appCommit: "test-commit" });
  expect(readFileSync(join(artifact, "authority.sqlite")).length).toBeGreaterThan(0);
  expect(existsSync(join(artifact, "authority.sqlite-wal"))).toBe(false);
  authority.command({ commandId: "after-backup", roomId: cfg.roomId, sessionId: null, expectedRevision: 1, type: "create_session", payload: { title: "Absent after restore", timezone: "UTC", plannedStartMs: Date.now() } }, signed.session.access);
  authority.close(); db.close();
  await restoreBackup(artifact, cfg);
  const restored = openExisting(cfg.dbPath);
  verifyDatabase(restored, cfg);
  expect(deployment(restored).generation).not.toBe(before.generation);
  expect(deployment(restored).recoveryNotice).toMatchObject({ backupRevision: 1, backupTakenAtMs: manifest.timestamp });
  expect(exportWorkspace(restored).snapshot).toEqual(before.snapshot);
  expect(exportWorkspace(restored).receipts).toEqual(before.receipts);
  expect(restored.prepare("SELECT 1 FROM command_log WHERE command_id = 'after-backup'").get()).toBeUndefined();
  expect(restored.prepare("SELECT count(*) AS n FROM login_sessions").get()!.n).toBe(0);
  expect(restored.prepare("SELECT enabled FROM accounts WHERE actor_id=?").get(actor)!.enabled).toBe(0);
  expect(() => currentSession(restored, request("/", undefined, headers(signed.token)))).toThrow();
  await expect(login(restored, "restore-user", "long backup password")).rejects.toThrow();
  await updateUser(restored, "restore-user", "reset-password", "revalidated password");
  expect((await login(restored, "restore-user", "revalidated password")).session.access.actorId).toBe(actor);
  const operational = new RoomAuthority(cfg.roomId, cfg.dbPath, cfg);
  const restoredAccess = (await login(restored, "restore-user", "revalidated password")).session.access;
  const sessionId = before.snapshot.sessions[0].id;
  expect(operational.command({ commandId: "delete-active", roomId: cfg.roomId, sessionId, expectedRevision: before.snapshot.revision, type: "start_live", payload: {} }, restoredAccess).status).toBe(200);
  expect(() => deleteWorkspace(cfg, cfg.workspaceId, true)).toThrow("active LIVE");
  expect(operational.command({ commandId: "delete-ended", roomId: cfg.roomId, sessionId, expectedRevision: before.snapshot.revision + 1, type: "end_live", payload: {} }, restoredAccess).status).toBe(200);
  operational.close(); restored.close();
  // Tampered backup is rejected before maintenance marker or any database replacement.
  appendFileSync(join(artifact, "authority.sqlite"), "tamper");
  await expect(restoreBackup(artifact, cfg)).rejects.toThrow("checksum");
  expect(existsSync(markerPath(cfg))).toBe(false);
  // Cleanup failure leaves a durable incomplete deletion, even after retirement was recorded.
  const originalManifest = readFileSync(join(artifact, "manifest.json"), "utf8");
  writeFileSync(join(artifact, "manifest.json"), "invalid JSON");
  expect(() => deleteWorkspace(cfg, cfg.workspaceId, true)).toThrow();
  expect(existsSync(markerPath(cfg))).toBe(true);
  expect(existsSync(cfg.dbPath)).toBe(true);
  writeFileSync(join(artifact, "manifest.json"), originalManifest);
  deleteWorkspace(cfg, cfg.workspaceId, true, true);
  expect(existsSync(cfg.dbPath)).toBe(false);
  expect(existsSync(artifact)).toBe(false);
  expect(() => assertNotRetired(cfg)).toThrow("retired");
  expect(() => initialize(cfg)).toThrow("retired");
  expect(status(cfg).ready).toBe(false);
}, 60000);

test("bounded chunked bodies, exact CSRF/context, fixed-window limits, concurrency and secret-safe logs", async () => {
  const cfg = config();
  for (const origin of ["", "null", "https://other.example"]) expect(() => csrf(request("/", {}, { Origin: origin }), cfg)).toThrow();
  expect(() => checkContext(request("/"), { workspaceId: cfg.workspaceId, roomId: cfg.roomId, generation: randomUUID() })).toThrow("headers");
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(3000)); controller.enqueue(new Uint8Array(3000)); } });
  const chunked = new Request("https://livelift.example.com", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await expect(readJson(chunked, 4096)).rejects.toMatchObject({ status: 413 });
  await expect(readJson(request("/", {}, { "Content-Length": "5000" }), 4096)).rejects.toMatchObject({ status: 413 });
  const limits = new Limiter(2);
  for (let n = 0; n < 5; n++) limits.check("account", 5, 900000, true, 0);
  expect(() => limits.check("account", 5, 900000, true, 0)).toThrow("Request limit");
  limits.check("account", 5, 900000, true, 900000);
  for (let n = 0; n < 120; n++) limits.check("commands", 120, 60000, true, 900000);
  expect(() => limits.check("commands", 120, 60000, true, 900000)).toThrow();
  expect(() => limits.check("storage-full", 1, 60000, true, 900000)).toThrow();
  const ipLimit = new Limiter(1);
  for (let n = 0; n < 20; n++) ipLimit.check("ip", 20, 900000, true, 0);
  expect(() => ipLimit.check("ip", 20, 900000, true, 0)).toThrow();
  const hashes = await Promise.all(Array.from({ length: 4 }, () => passwordHash("concurrent password", "00".repeat(16))));
  expect(new Set(hashes).size).toBe(1);
  const capture = vi.spyOn(console, "log").mockImplementation(() => {});
  log("storage_error", { status: 503, password: "SECRET", cookie: "SECRET", requestBody: "SECRET", error: "SECRET" } as Parameters<typeof log>[1]);
  expect(String(capture.mock.calls[0][0])).not.toContain("SECRET");
  expect(JSON.parse(String(capture.mock.calls[0][0]))).toMatchObject({ event: "storage_error", status: 503 });
}, 60000);

test("readiness is cached without revisions, maintenance is durable, locks exclude replacement", async () => {
  const cfg = config(); initialize(cfg); production(cfg);
  const runtime = await getRuntime();
  const before = runtime.authority.db.prepare("SELECT revision, clock_ms FROM room_state").get();
  expect(ready(runtime)).toBe(true); expect(ready(runtime)).toBe(true);
  expect(runtime.authority.db.prepare("SELECT revision, clock_ms FROM room_state").get()).toEqual(before);
  await expect(installationLock(cfg, false, ".livelift-maintenance.lock")).rejects.toThrow("in use");
  const shared = await installationLock(cfg, true, ".livelift-maintenance.lock"); await shared();
  durableJson(markerPath(cfg), { operation: "restore", workspaceId: cfg.workspaceId });
  expect(ready(runtime)).toBe(false);
  expect((await readiness(request("/api/readyz"))).status).toBe(503);
  await closeRuntime();
  await expect(getRuntime()).rejects.toThrow("unavailable");
});
