// Mount the existing route functions on Node HTTP for the unchanged, explicitly non-production harness.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { closeRuntime } from "../.ops/src/lib/server/runtime.js";
import { GET as room } from "../.ops/src/app/api/v3/room/route.js";
import { POST as command } from "../.ops/src/app/api/v3/room/commands/route.js";
import { GET as receipt } from "../.ops/src/app/api/v3/room/commands/[commandId]/route.js";
const folder = mkdtempSync(join(tmpdir(), "livelift-phase2-"));
Object.assign(process.env, { NODE_ENV: "development", LIVELIFT_ROOM_ID: "room-aud-01", LIVELIFT_DB_PATH: join(folder, "authority.sqlite"), LIVELIFT_CAPABILITIES: JSON.stringify([ { token: "test-operator-token", roomId: "room-aud-01", actorId: "actor-op-1", name: "Lead Operator", role: "operator" }, { token: "test-viewer-token", roomId: "room-aud-01", actorId: "actor-vw-1", name: "Guest Viewer", role: "viewer" } ]) });
delete process.env.LIVELIFT_WORKSPACE_ID;
const server = createServer(async (incoming, outgoing) => {
  try {
    const headers = Object.fromEntries(Object.entries(incoming.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : value ?? ""]));
    const request = new Request(`http://127.0.0.1${incoming.url}`, { method: incoming.method, headers, ...(incoming.method === "POST" ? { body: Readable.toWeb(incoming), duplex: "half" } : {}) });
    const path = new URL(request.url).pathname;
    const response = path === "/api/v3/room" ? await room(request) : path === "/api/v3/room/commands" ? await command(request) : await receipt(request, { params: Promise.resolve({ commandId: decodeURIComponent(path.split("/").at(-1)) }) });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end(); }
});
try {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const tests = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "src/__tests__/phase2/authority.acceptance.test.ts"], { env: { ...process.env, NODE_ENV: "test", LIVELIFT_AUTH_MODE: "bearer", LIVELIFT_TEST_SERVER_URL: `http://127.0.0.1:${port}` }, stdio: "inherit" });
  process.exitCode = await new Promise((r) => tests.once("exit", r));
} finally {
  server.closeAllConnections(); await new Promise((r) => server.close(r));
  await closeRuntime(); rmSync(folder, { recursive: true, force: true });
}
