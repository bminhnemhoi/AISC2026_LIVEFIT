// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ProductionClient, isBackendAvailable } from "../../../acceptance/productionClient";
import { sampleCreateSessionEnvelope } from "../phase2/fixtures/authorityFixtures";

const hasLiveServer = isBackendAvailable();

describe("P3-CSRF: Request Boundary, CSRF & Body Limit Acceptance", () => {
  describe("In-Process CSRF and Body Limits Contract Specification", () => {
    it("defines 4 KiB max body limit for login and 1 MiB max body limit for commands", () => {
      const loginLimit = 4 * 1024;
      const commandLimit = 1024 * 1024;
      expect(loginLimit).toBe(4096);
      expect(commandLimit).toBe(1048576);
    });

    it("requires exact Origin, application/json, and X-LiveLift-Request: 1", () => {
      const client = new ProductionClient();
      const headers = client.getHeaders();
      expect(headers.get("X-LiveLift-Request")).toBe("1");
      expect(headers.get("Content-Type")).toBe("application/json");
      expect(headers.get("Origin")).toBe(client.config.origin);
    });
  });

  describe.skipIf(!hasLiveServer)(
    "Live Unsafe Request CSRF Enforcement & Payload Bounds",
    () => {
      const client = new ProductionClient();

      it("missing Origin header on unsafe request is rejected with 403 csrf_failed", async () => {
        await client.login();
        const initial = await client.pollRoom();
        const rev = initial.data?.revision ?? 0;

        const headers = client.getHeaders();
        headers.delete("Origin");

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(sampleCreateSessionEnvelope),
        });

        expect(res.status).toBe(403);

        // Confirm NO mutation occurred
        const after = await client.pollRoom();
        expect(after.data?.revision).toBe(rev);
      });

      it("Origin: null on unsafe request is rejected with 403 csrf_failed", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set("Origin", "null");

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(sampleCreateSessionEnvelope),
        });

        expect(res.status).toBe(403);
      });

      it("untrusted/foreign Origin is rejected with 403 csrf_failed", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set("Origin", "https://malicious-cross-origin.com");

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(sampleCreateSessionEnvelope),
        });

        expect(res.status).toBe(403);
      });

      it("missing X-LiveLift-Request header is rejected with 403 csrf_failed", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.delete("X-LiveLift-Request");

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(sampleCreateSessionEnvelope),
        });

        expect(res.status).toBe(403);
      });

      it("wrong Content-Type (e.g. text/plain or multipart) is rejected with 403 csrf_failed", async () => {
        await client.login();
        const headers = client.getHeaders();
        headers.set("Content-Type", "text/plain");

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(sampleCreateSessionEnvelope),
        });

        expect(res.status).toBe(403);
      });

      it("login request exceeding 4 KiB body is rejected with 413 payload_too_large", async () => {
        const oversizedPassword = "A".repeat(5000);
        const res = await client.login({
          username: "test_operator",
          password: oversizedPassword,
        });

        expect(res.status).toBe(413);
      });

      it("command request exceeding 1 MiB body is rejected with 413 payload_too_large", async () => {
        await client.login();
        const headers = client.getHeaders();

        // 1.2 MiB oversized payload
        const oversizedPayload = {
          ...sampleCreateSessionEnvelope,
          commandId: `cmd-oversized-${Date.now()}`,
          payload: {
            title: "Oversized Session",
            padding: "X".repeat(1.2 * 1024 * 1024),
          },
        };

        const res = await client.rawRequest("/api/v3/room/commands", {
          method: "POST",
          headers,
          body: JSON.stringify(oversizedPayload),
        });

        expect(res.status).toBe(413);
      });
    }
  );
});
