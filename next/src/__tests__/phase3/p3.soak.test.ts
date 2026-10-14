// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { parseDuration, parseSoakArgs, readPasswordFile } from "../../../acceptance/liveSoak";
import { createSession } from "@/lib/domain/engine";
import type { Session } from "@/contracts/session";
import type { AuthorityReceipt, CommandEnvelope } from "@/contracts/authority";
import { CANARY_SECRETS, TEST_WORKSPACE_ID, TEST_GENERATION, TEST_NEW_GENERATION } from "../../../acceptance/contractFixtures";
import { SoakRunner, DEFAULT_48H_CONFIG } from "../../../acceptance/soakRunner";
import { isBackendAvailable } from "../../../acceptance/productionClient";

describe("P3-SOAK: 48-Hour Production Rehearsal & Smoke Soak Matrix", () => {
  describe("Executable Soak Runner Specifications", () => {
    it("defines 48-hour rehearsal configuration", () => {
      expect(DEFAULT_48H_CONFIG.mode).toBe("rehearsal_48h");
      expect(DEFAULT_48H_CONFIG.durationMs).toBe(48 * 60 * 60 * 1000);
      expect(DEFAULT_48H_CONFIG.pollIntervalMs).toBe(2000);
      expect(DEFAULT_48H_CONFIG.commandIntervalMs).toBe(10000);
      expect(DEFAULT_48H_CONFIG.healthIntervalMs).toBe(30000);
      expect(DEFAULT_48H_CONFIG.numViewers).toBe(10);
    });

    it("executes short smoke mode and collects metrics without invariant violations", async () => {
      const runner = new SoakRunner({
        mode: "smoke",
        durationMs: isBackendAvailable() ? 3500 : 800, // Account for scrypt login time when live backend is active
        pollIntervalMs: 100,
        commandIntervalMs: 200,
        healthIntervalMs: 300,
        networkGlitchProbability: 0.2, // Exercise network drop & receipt reconciliation
        numViewers: 2,
      });

      const metrics = await runner.run();

      expect(metrics.durationMs).toBeGreaterThanOrEqual(700);
      expect(metrics.pollsTotal).toBeGreaterThan(0);
      expect(metrics.commandsSubmitted).toBeGreaterThan(0);
      expect(metrics.healthChecksTotal).toBeGreaterThan(0);
      expect(metrics.invariantViolations.length).toBe(0);

      const report = runner.generateReport();
      expect(report).toContain("LiveLift V3 Phase 3 Soak Rehearsal Report");
      expect(report).toContain("Result: PASS");
    }, 10000);
  });
});

describe("Live-only release CLI", () => {
  it("parses modes, durations, defaults and help", () => {
    expect(["30s", "5m", "1h", "48h"].map(parseDuration)).toEqual([30_000, 300_000, 3_600_000, 172_800_000]);
    expect(parseSoakArgs([])).toMatchObject({ mode: "smoke", durationMs: 30_000 });
    expect(parseSoakArgs(["--mode", "rehearsal_48h"])).toMatchObject({ mode: "rehearsal_48h", durationMs: 172_800_000, pollIntervalMs: 2000, commandIntervalMs: 10_000 });
    expect(parseSoakArgs(["--mode", "smoke", "--duration", "5m"])).toMatchObject({ durationMs: 300_000 });
    expect(parseSoakArgs(["--help"])).toEqual({ help: true });
  });

  it("rejects malformed/unsafe durations and arguments without echoing input", () => {
    for (const value of ["", "0s", "-1s", "1.5h", "30", "1d", " 5m", "5m ", "1e3s", "Infinityh", "01s", "999999999999999h"]) expect(() => parseDuration(value)).toThrow("invalid_duration");
    for (const args of [["--mode", "simulation"], ["--password", CANARY_SECRETS.password], ["--duration", "1s", "--duration", "2s"], ["extra"]]) expect(() => parseSoakArgs(args)).toThrow();
  });

  it("requires owned mode-0600 password files and preserves spaces", () => {
    const dir = mkdtempSync(join(tmpdir(), "soak-password-test-"));
    const path = join(dir, "password");
    try {
      writeFileSync(path, "  password with spaces  \n", { mode: 0o600 });
      expect(readPasswordFile(path)).toBe("  password with spaces  ");
      chmodSync(path, 0o644);
      expect(() => readPasswordFile(path)).toThrow("invalid_protected_password_file");
      chmodSync(path, 0o600);
      writeFileSync(path, CANARY_SECRETS.password + "\nextra\n");
      expect(() => readPasswordFile(path)).toThrow("invalid_protected_password_file");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  // Controlled HTTP peer for CLI regression tests; production certification is a separate live run.
  async function cliPeer(mode = "smoke", fault = "", signal?: "SIGINT" | "SIGTERM") {
    const dir = mkdtempSync(join(tmpdir(), "soak-cli-test-"));
    const passwordFile = join(dir, "password");
    writeFileSync(passwordFile, CANARY_SECRETS.password + "\n", { mode: 0o600 });
    let revision = 0, viewerPolls = 0, logins = 0, commandPosts = 0;
    let sessions: Session[] = [];
    const receipts = new Map<string, AuthorityReceipt>();
    const intents = new Map<string, string>();
    let child: ReturnType<typeof spawn> | undefined;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let dropped = false;
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const role = req.headers.cookie?.includes("viewer") ? "viewer" : "operator";
      const access = { actorId: `${role}-actor`, name: `${role} name`, role };
      const context = { workspaceId: TEST_WORKSPACE_ID, roomId: "studio", generation: TEST_GENERATION };
      const reply = (data: unknown, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
      if (req.url === "/api/v3/auth/login") {
        logins++;
        if (fault === "auth") return reply({ error: { code: "invalid_credentials", message: CANARY_SECRETS.password } }, 401);
        const credentials = JSON.parse(body);
        expect(credentials.password).toBe(CANARY_SECRETS.password);
        const loginRole = credentials.username === "viewer" ? "viewer" : "operator";
        res.setHeader("set-cookie", `__Host-livelift_session=${loginRole}-${CANARY_SECRETS.token}; Secure; HttpOnly; Path=/`);
        return reply({ ...context, access: { ...access, role: loginRole, actorId: `${loginRole}-actor` }, expiresAtMs: Date.now() + (fault === "expiry" && logins <= 2 ? 100 : 43_200_000), recoveryNotice: null });
      }
      if (req.url === "/api/v3/auth/logout") return reply({ success: true });
      if (req.url === "/api/v3/auth/session") return reply({ ...context, generation: fault === "generation" ? TEST_NEW_GENERATION : TEST_GENERATION, access, expiresAtMs: Date.now() + 43_200_000, recoveryNotice: null });
      if (req.url?.startsWith("/api/v3/room/commands/")) {
        const id = req.url.split("/").at(-1)!.split("?")[0];
        return receipts.has(id) ? reply(receipts.get(id)) : reply({ error: { code: "not_found", message: CANARY_SECRETS.cookieValue } }, 404);
      }
      if (req.url === "/api/v3/room/commands") {
        const envelope = JSON.parse(body) as CommandEnvelope;
        commandPosts++;
        const previous = receipts.get(envelope.commandId);
        if (previous) {
          expect(intents.get(envelope.commandId)).toBe(body);
          return reply({ receipt: previous, duplicate: true });
        }
        if (envelope.type !== "create_session" && envelope.type !== "save_prepare") return reply({}, 422);
        const session = createSession({ id: "soak-draft", title: envelope.payload.title!, timezone: "UTC", plannedStartMs: Date.now(), environment: "REAL", nowMs: Date.now(), operator: { id: access.actorId, name: access.name, role: "lead", isLead: true } });
        if (sessions.length) session.revision = sessions[0].revision + 1;
        sessions = [session];
        const receipt: AuthorityReceipt = { commandId: envelope.commandId, type: envelope.type, outcome: "committed", code: null, message: null, roomRevisionAfter: ++revision, sessionId: session.id, sessionRevisionAfter: session.revision, eventIds: [] };
        receipts.set(envelope.commandId, receipt); intents.set(envelope.commandId, body);
        if (signal && !stopTimer) stopTimer = setTimeout(() => child?.kill(signal), 100);
        if (fault === "lost_response") { res.destroy(); return; }
        return reply({ receipt, duplicate: false });
      }
      if (req.url?.startsWith("/api/v3/room")) {
        if (role === "viewer") viewerPolls++;
        if (fault === "disconnect" && !dropped) { dropped = true; res.destroy(); return; }
        const readRevision = fault === "revision" && role === "viewer" ? -1 : revision;
        return reply({ roomId: "studio", revision: readRevision, changed: true, sessions: fault === "divergence" && role === "viewer" ? [] : sessions, access, serverNowMs: Date.now(), clockBehindByMs: 0 });
      }
      return reply(req.url === "/api/readyz" ? { ready: true } : { live: true });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No HTTP peer address");
    try {
      child = spawn(process.execPath, ["acceptance/soak.mjs", "--mode", mode, "--duration", signal ? "48h" : "1s"], {
        cwd: process.cwd(), env: { ...process.env, LIVELIFT_TEST_SERVER_URL: `http://127.0.0.1:${address.port}`,
          LIVELIFT_WORKSPACE_ID: TEST_WORKSPACE_ID, LIVELIFT_ROOM_ID: "studio", LIVELIFT_APP_ORIGIN: `http://127.0.0.1:${address.port}`,
          LIVELIFT_GENERATION: TEST_GENERATION, LIVELIFT_OPERATOR_USERNAME: "operator", LIVELIFT_VIEWER_USERNAME: "viewer",
          LIVELIFT_OPERATOR_PASSWORD_FILE: passwordFile, LIVELIFT_VIEWER_PASSWORD_FILE: passwordFile,
          LIVELIFT_SOAK_OPS_EXECUTABLE: "" }, stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "", stderr = "";
      child.stdout!.on("data", chunk => { stdout += chunk; });
      child.stderr!.on("data", chunk => { stderr += chunk; });
      const [code] = await once(child, "exit");
      for (const secret of Object.values(CANARY_SECRETS)) expect(stdout + stderr).not.toContain(secret);
      const final = JSON.parse(stdout.trim().split("\n").at(-1)!);
      return { code, final, logins, viewerPolls, commandPosts, receiptCount: receipts.size, stdout, stderr };
    } finally {
      child?.kill();
      if (stopTimer) clearTimeout(stopTimer);
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it.each(["smoke", "rehearsal_48h"])("executes canonical %s entry point with both roles and durable receipts", async mode => {
    const result = await cliPeer(mode);
    expect(result.code).toBe(0);
    expect(result.logins).toBe(2);
    expect(result.viewerPolls).toBeGreaterThan(0);
    expect(result.commandPosts).toBe(2); // first intent + exact duplicate replay
    expect(result.receiptCount).toBe(1);
    expect(result.final).toMatchObject({ event: "final", result: "PASS", invariantViolations: 0, committed: 1, reconciled: 1, duplicates: 1, readInterruptionsInjected: 1 });
    expect(result.final.invariantChecks).toBeGreaterThan(0);
    expect(result.stdout).toContain('"credentials":"[REDACTED]"');
  }, 10_000);

  it.each(["revision", "generation", "divergence"])("exits nonzero on %s invariant failure", async fault => {
    const result = await cliPeer("smoke", fault);
    expect(result.code).toBe(1);
    expect(result.final).toMatchObject({ result: "FAIL", invariantViolations: 1 });
  }, 10_000);

  it("fails closed on authentication errors with redacted server error text", async () => {
    const result = await cliPeer("smoke", "auth");
    expect(result.code).toBe(1);
    expect(result.final.failureCode).toBe("auth_or_server_failure");
  });

  it.each(["disconnect", "lost_response", "expiry"])("recovers %s with live HTTP semantics", async fault => {
    const result = await cliPeer("smoke", fault);
    expect(result.code).toBe(0);
    expect(result.receiptCount).toBe(1);
    expect(result.final.invariantViolations).toBe(0);
    if (fault === "expiry") expect(result.logins).toBe(4);
    else expect(result.final.reconnects).toBeGreaterThan(1);
  }, 10_000);

  it.each(["SIGINT", "SIGTERM"] as const)("handles %s with final STOPPED summary", async signal => {
    const result = await cliPeer("smoke", "", signal);
    expect(result.code).toBe(signal === "SIGINT" ? 130 : 143);
    expect(result.final).toMatchObject({ event: "final", result: "STOPPED", committed: 1 });
    expect(result.final.elapsedMs).toBeLessThan(5000);
  }, 10_000);
});
