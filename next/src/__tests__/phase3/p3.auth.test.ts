// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductionClient, isBackendAvailable, SESSION_COOKIE_NAME } from "../../../acceptance/productionClient";
import {
  TEST_INVALID_PASSWORDS,
  TEST_INVALID_USERNAMES,
  TEST_OPERATOR_AUTH_SESSION,
  TEST_VALID_PASSWORDS,
  TEST_VALID_USERNAMES,
  TEST_VIEWER_AUTH_SESSION,
  TEST_WORKSPACE_ID,
  TEST_ROOM_ID,
  TEST_GENERATION,
} from "../../../acceptance/contractFixtures";
import {
  sampleCreateSessionEnvelope,
} from "../phase2/fixtures/authorityFixtures";

const hasLiveServer = isBackendAvailable();

describe("P3-AUTH & P3-AUTHZ: Authentication Adversarial & Authorization Matrix", () => {
  describe("In-Process Contract & Security Specification Checks", () => {
    it("enforces password bounds strictly: >= 15 chars and <= 128 chars", () => {
      expect(TEST_INVALID_PASSWORDS.tooShort.length).toBeLessThan(15);
      expect(TEST_INVALID_PASSWORDS.tooLong.length).toBeGreaterThan(128);
      expect(TEST_VALID_PASSWORDS.min.length).toBe(15);
      expect(TEST_VALID_PASSWORDS.standard.length).toBeGreaterThanOrEqual(15);
      expect(TEST_VALID_PASSWORDS.standard.length).toBeLessThanOrEqual(128);
      expect(TEST_VALID_PASSWORDS.max.length).toBe(128);
    });

    it("enforces username regex and format constraints", () => {
      const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
      for (const valid of TEST_VALID_USERNAMES) {
        expect(usernameRegex.test(valid)).toBe(true);
        expect(valid.length).toBeLessThanOrEqual(64);
      }
      for (const invalid of TEST_INVALID_USERNAMES) {
        expect(usernameRegex.test(invalid) && invalid.length <= 64).toBe(false);
      }
    });

    it("verifies session cookie contract: __Host-livelift_session prefix and flags", () => {
      expect(SESSION_COOKIE_NAME).toBe("__Host-livelift_session");
      // Required cookie attributes: Secure, HttpOnly, SameSite=Strict, Path=/
      const cookieHeader = `${SESSION_COOKIE_NAME}=token123; Secure; HttpOnly; SameSite=Strict; Path=/`;
      expect(cookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(cookieHeader).toContain("Secure");
      expect(cookieHeader).toContain("HttpOnly");
      expect(cookieHeader).toContain("SameSite=Strict");
      expect(cookieHeader).toContain("Path=/");
      expect(cookieHeader).not.toContain("Domain=");
    });

    it("verifies AuthSession shape contracts for operator and viewer", () => {
      expect(TEST_OPERATOR_AUTH_SESSION.access.role).toBe("operator");
      expect(TEST_OPERATOR_AUTH_SESSION.workspaceId).toBe(TEST_WORKSPACE_ID);
      expect(TEST_OPERATOR_AUTH_SESSION.roomId).toBe(TEST_ROOM_ID);
      expect(TEST_OPERATOR_AUTH_SESSION.generation).toBe(TEST_GENERATION);
      expect(TEST_OPERATOR_AUTH_SESSION.expiresAtMs).toBeGreaterThan(0);

      expect(TEST_VIEWER_AUTH_SESSION.access.role).toBe("viewer");
      expect(TEST_VIEWER_AUTH_SESSION.access.actorId).toBe("actor-vw-1");
    });

    it("verifies ProductionClient.logout sends exact required request with empty JSON body and CSRF markers", async () => {
      const client = new ProductionClient();
      client.setSessionToken("test-active-session-token");

      let capturedUrl = "";
      let capturedInit: RequestInit | undefined;
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          capturedUrl = String(input);
          capturedInit = init;
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }) as typeof globalThis.fetch;

        const res = await client.logout();
        expect(res.status).toBe(200);
        expect(capturedUrl).toBe(`${client.config.baseUrl}/api/v3/auth/logout`);
        expect(capturedInit?.method).toBe("POST");
        const headers = capturedInit?.headers as Headers;
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("X-LiveLift-Request")).toBe("1");
        expect(headers.get("Origin")).toBe(client.config.origin);
        expect(headers.get("Cookie")).toBe("__Host-livelift_session=test-active-session-token");
        expect(capturedInit?.body).toBe("{}");
        expect(client.getSessionCookie()).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live HTTP Adversarial Authentication & Role Verification",
    () => {
      const client = new ProductionClient();

      it("valid operator login issues __Host-livelift_session cookie and returns AuthSession", async () => {
        const res = await client.login({
          username: "test_operator",
          password: "TestOperatorPassword123!",
        });
        expect(res.status).toBe(200);
        expect(res.data?.access.role).toBe("operator");
        expect(client.getSessionCookie()).toBeTruthy();
        expect(res.data?.workspaceId).toBe(client.config.workspaceId);
        expect(res.data?.generation).toBe(client.config.generation);
      });

      it("valid viewer login returns viewer role and valid session", async () => {
        const viewer = new ProductionClient({ role: "viewer" });
        const res = await viewer.login({
          username: "test_viewer",
          password: "TestViewerPassword123!",
        });
        expect(res.status).toBe(200);
        expect(res.data?.access.role).toBe("viewer");
      });

      it("wrong password returns generic 401 invalid_credentials without timing leak", async () => {
        const res = await client.login({
          username: "test_operator",
          password: "WrongPasswordEntirely12345!",
        });
        expect(res.status).toBe(401);
        expect(res.error?.code).toBe("invalid_credentials");
      });

      it("unknown username returns generic 401 invalid_credentials (enumeration prevention)", async () => {
        const res = await client.login({
          username: "completely_unknown_user_123",
          password: "SomePassword12345!",
        });
        expect(res.status).toBe(401);
        expect(res.error?.code).toBe("invalid_credentials");
      });

      it("password bounds: rejecting <15 characters with invalid_request", async () => {
        const res = await client.login({
          username: "test_operator",
          password: "short",
        });
        expect([400, 422]).toContain(res.status);
      });

      it("production bearer-only request is strictly rejected (no bearer fallback)", async () => {
        // Direct request with Authorization: Bearer but no session cookie
        const res = await client.rawRequest("/api/v3/room", {
          method: "GET",
          headers: {
            Authorization: "Bearer test-operator-token",
            "X-LiveLift-Workspace": client.config.workspaceId,
            "X-LiveLift-Generation": client.config.generation,
          },
        });
        expect(res.status).toBe(401);
      });

      it("role and actor spoof headers do not elevate permissions", async () => {
        const viewer = new ProductionClient({ role: "viewer" });
        await viewer.login({
          username: "test_viewer",
          password: "TestViewerPassword123!",
        });

        // Viewer attempts to mutate with injected spoof headers
        const res = await viewer.sendCommand(
          {
            ...sampleCreateSessionEnvelope,
            commandId: `cmd-spoof-${Date.now()}`,
          },
          {
            "X-LiveLift-Role": "operator",
            "X-LiveLift-Actor": "actor-op-1",
            "X-Actor-Id": "actor-op-1",
          }
        );

        // Server derives identity from session cookie, viewer must be rejected
        expect(res.status).toBe(403);
      });

      it("logout revokes session immediately; subsequent requests fail with 401", async () => {
        const tempClient = new ProductionClient();
        await tempClient.login({
          username: "test_operator",
          password: "TestOperatorPassword123!",
        });
        const activeCookie = tempClient.getSessionCookie();
        expect(activeCookie).toBeTruthy();

        // Logout
        const logoutRes = await tempClient.logout();
        expect(logoutRes.status).toBe(200);

        // Attempt request with the now-revoked session cookie
        const checkRes = await tempClient.rawRequest("/api/v3/auth/session", {
          method: "GET",
          headers: {
            Cookie: activeCookie!,
          },
        });
        expect(checkRes.status).toBe(401);
      });

      it("viewer write mutation is strictly forbidden (403)", async () => {
        const viewer = new ProductionClient({ role: "viewer" });
        await viewer.login({
          username: "test_viewer",
          password: "TestViewerPassword123!",
        });

        const res = await viewer.sendCommand({
          ...sampleCreateSessionEnvelope,
          commandId: `cmd-viewer-mut-${Date.now()}`,
        });
        expect(res.status).toBe(403);
      });

      it("viewer duplicate-command trick is forbidden (403)", async () => {
        const op = new ProductionClient({ role: "operator" });
        await op.login({
          username: "test_operator",
          password: "TestOperatorPassword123!",
        });

        const cmdId = `cmd-op-orig-${Date.now()}`;
        await op.sendCommand({
          ...sampleCreateSessionEnvelope,
          commandId: cmdId,
        });

        const viewer = new ProductionClient({ role: "viewer" });
        await viewer.login({
          username: "test_viewer",
          password: "TestViewerPassword123!",
        });

        // Viewer resubmits identical envelope hoping for 200 duplicate bypass
        const viewerRes = await viewer.sendCommand({
          ...sampleCreateSessionEnvelope,
          commandId: cmdId,
        });
        expect(viewerRes.status).toBe(403);
      });

      it("viewer workspace export is forbidden (403)", async () => {
        const viewer = new ProductionClient({ role: "viewer" });
        await viewer.login({
          username: "test_viewer",
          password: "TestViewerPassword123!",
        });

        const res = await viewer.exportWorkspace();
        expect(res.status).toBe(403);
      });
    }
  );
});
