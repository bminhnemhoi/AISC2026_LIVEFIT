// Real CLI + production HTTP smoke after build:ops and build; isolated temporary storage.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { createServer } from "node:net";
const storage = mkdtempSync(join(tmpdir(), "livelift-smoke-"));
const password = randomBytes(24).toString("base64url");
const env = { ...process.env, NODE_ENV: "production", LIVELIFT_APP_ORIGIN: "https://livelift.example.com", LIVELIFT_WORKSPACE_ID: randomUUID(), LIVELIFT_ROOM_ID: "studio", LIVELIFT_DB_PATH: join(storage, "authority.sqlite"), LIVELIFT_BACKUP_DIR: join(storage, "backups"), LIVELIFT_APP_COMMIT: "smoke", LIVELIFT_TRUST_PROXY: "caddy" };
const listener = createServer();
await new Promise((r) => listener.listen(0, "127.0.0.1", r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
let app;
let assertions = 0;
function check(value) { assert(value); assertions++; }
async function ops(args, secret, success = true) {
  const child = spawn(process.execPath, [".ops/scripts/ops.js", ...args], { env, stdio: ["pipe", "pipe", "pipe"] });
  let output = "", errors = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  child.stdin.end(secret === undefined ? undefined : secret + "\n");
  const code = await new Promise((r) => child.once("exit", r));
  check(success ? code === 0 : code !== 0);
  check(!output.includes(password) && !errors.includes(password));
  return output.trim().split("\n").at(-1);
}
async function start() {
  app = spawn(process.execPath, process.env.LIVELIFT_SMOKE_STANDALONE === "1" ? ["server.js"] : ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...env, PORT: String(port), HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  app.stdout.on("data", (chunk) => { logs += chunk; }); app.stderr.on("data", (chunk) => { logs += chunk; });
  for (let n = 0; n < 100; n++) {
    if (app.exitCode !== null) throw new Error("Production startup failed");
    try { if ((await fetch(`http://127.0.0.1:${port}/api/readyz`)).ok) { check(!logs.includes(password)); return; } } catch { /* Startup. */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Production startup timed out");
}
async function stop() {
  if (!app || app.exitCode !== null) return;
  const exited = new Promise((r) => app.once("exit", r)); app.kill("SIGTERM");
  const timer = setTimeout(() => app.kill("SIGKILL"), 5000);
  await exited; clearTimeout(timer); app = undefined;
}
async function http(path, body, context, extra = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? "GET" : "POST", headers: { Origin: env.LIVELIFT_APP_ORIGIN, "Content-Type": "application/json", "X-LiveLift-Request": "1", "X-LiveLift-Client-IP": "192.0.2.10", ...(context ? { Cookie: context.cookie, "X-LiveLift-Workspace": context.workspaceId, "X-LiveLift-Generation": context.generation } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function signIn(username = "lead") {
  const response = await http("/api/v3/auth/login", { username, password }); check(response.status === 200);
  return { ...await response.json(), cookie: response.headers.get("set-cookie").split(";")[0] };
}
try {
  await ops(["init", "--maintenance"]);
  for (const [username, role] of [["lead", "operator"], ["watch", "viewer"]]) await ops(["user", "add", username, "--name", username, "--role", role, "--password-stdin"], password);
  check(JSON.parse(await ops(["status", "--json"])).ready);
  await start();
  check((await http("/api/healthz")).status === 200);
  check((await http("/api/v3/room", undefined, undefined, { Authorization: "Bearer ignored" })).status === 401);
  const context = await signIn();
  check((await http("/api/v3/room", undefined, { ...context, generation: randomUUID() })).status === 409);
  check((await http("/api/v3/room", undefined, { ...context, workspaceId: randomUUID() })).status === 404);
  const envelope = { commandId: "smoke-create", roomId: env.LIVELIFT_ROOM_ID, sessionId: null, expectedRevision: 0, type: "create_session", payload: { title: "Production smoke", timezone: "UTC", plannedStartMs: Date.now() } };
  check((await http("/api/v3/room/commands", envelope, context, { Origin: "null" })).status === 403);
  check((await http("/api/v3/room/commands", envelope, await signIn("watch"))).status === 403);
  check((await http("/api/v3/room/commands", envelope, context)).status === 200);
  check((await (await http("/api/v3/room/commands", envelope, context)).json()).duplicate);
  const before = await (await http("/api/v3/room", undefined, context)).json();
  const artifact = await ops(["backup"]);
  check(JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8")).roomRevision === before.revision);
  const exported = await http("/api/v3/workspace/export", undefined, context);
  check(exported.status === 200 && exported.headers.get("cache-control") === "no-store");
  check(!/password_hash|token_hash|salt|SIMULATED/.test(await exported.text()));
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(1048577)); c.close(); } });
  const big = await fetch(`http://127.0.0.1:${port}/api/v3/room/commands`, { method: "POST", headers: { Origin: env.LIVELIFT_APP_ORIGIN, "Content-Type": "application/json", "X-LiveLift-Request": "1", Cookie: context.cookie, "X-LiveLift-Workspace": context.workspaceId, "X-LiveLift-Generation": context.generation }, body: stream, duplex: "half" });
  check(big.status === 413);
  check((await http("/api/v3/auth/logout", { pad: "x".repeat(5000) }, context)).status === 413);
  for (let n = 0; n < 5; n++) check((await http("/api/v3/auth/login", { username: "missing-smoke", password }, undefined, { "X-LiveLift-Client-IP": "192.0.2.11" })).status === 401);
  const throttled = await http("/api/v3/auth/login", { username: "missing-smoke", password }, undefined, { "X-LiveLift-Client-IP": "192.0.2.11" });
  check(throttled.status === 429 && Number(throttled.headers.get("retry-after")) > 0);
  await ops(["user", "set-role", "lead", "--role", "viewer"]);
  check((await http("/api/v3/room/commands", envelope, context)).status === 401);
  await ops(["user", "set-role", "lead", "--role", "operator"]);
  const current = await signIn();
  await ops(["restore", artifact, "--maintenance"], undefined, false);
  await stop(); await start();
  check((await (await http("/api/v3/room", undefined, current)).json()).revision === before.revision);
  await stop();
  const startTime = performance.now();
  await ops(["restore", artifact, "--maintenance"]);
  check(JSON.parse(await ops(["status", "--json"])).context.generation !== context.generation);
  await ops(["user", "reset-password", "lead", "--password-stdin"], password);
  await start();
  check((await http("/api/v3/auth/session", undefined, current)).status === 401);
  const revalidated = await signIn();
  check((await http("/api/v3/room", undefined, { ...revalidated, generation: context.generation })).status === 409);
  const after = await (await http("/api/v3/room", undefined, revalidated)).json();
  check(JSON.stringify(after.sessions) === JSON.stringify(before.sessions) && after.revision === before.revision);
  const rtoMs = Math.round(performance.now() - startTime); check(rtoMs < 3600000);
  await stop();
  writeFileSync(env.LIVELIFT_DB_PATH, "corrupted current installation");
  await ops(["restore", artifact, "--maintenance"]);
  check(readdirSync(join(storage, "rollback")).length >= 2);
  check(JSON.parse(await ops(["status", "--json"])).ready);
  await ops(["delete-workspace", "--maintenance", "--confirm-workspace", env.LIVELIFT_WORKSPACE_ID, "--prune-backups"]);
  await ops(["init", "--maintenance"], undefined, false);
  console.log(JSON.stringify({ event: "platform_smoke_pass", assertions, nodeVersion: process.version, restoreToAuthenticatedReadMs: rtoMs }));
} finally { await stop(); rmSync(storage, { recursive: true, force: true }); }
