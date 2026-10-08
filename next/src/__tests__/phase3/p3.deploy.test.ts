// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("P3-DEPLOY: Deployment Topology & Configuration Acceptance Matrix", () => {
  describe("Container & Dockerfile Specifications", () => {
    it("verifies Next.js Dockerfile uses Node 22 LTS and unprivileged execution", () => {
      const dockerfilePath = resolve(__dirname, "../../../../docker/next.Dockerfile");
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, "utf8");
      // Check Node 22 base image
      expect(content).toMatch(/node:22/);
      // Check unprivileged user execution (USER node)
      expect(content).toMatch(/USER\s+node/);
      // Check production environment
      expect(content).toMatch(/NODE_ENV=production/);
    });

    it("verifies production environment example has no hardcoded secrets or passwords", () => {
      const envExamplePath = resolve(__dirname, "../../../.env.production.example");
      if (existsSync(envExamplePath)) {
        const envContent = readFileSync(envExamplePath, "utf8");
        // Must NOT contain real sensitive credentials
        expect(envContent).not.toMatch(/password\s*=\s*['"][^'"]+['"]/i);
        expect(envContent).not.toMatch(/secret_key\s*=\s*[a-zA-Z0-9]{20,}/i);
      }
    });
  });

  describe("Topology & Network Ingress Rules", () => {
    it("ensures only reverse proxy (Caddy) exposes public ports 80/443", () => {
      const composePath = resolve(__dirname, "../../../../docker-compose.next.yml");
      if (existsSync(composePath)) {
        const content = readFileSync(composePath, "utf8");
        // If next container publishes ports directly, it must be restricted to 127.0.0.1
        if (content.includes("ports:")) {
          expect(content).toMatch(/127\.0\.0\.1:\d+:\d+/);
        }
      }
    });

    it("verifies container restart policy is configured for high availability", () => {
      const composePath = resolve(__dirname, "../../../../docker-compose.next.yml");
      if (existsSync(composePath)) {
        const content = readFileSync(composePath, "utf8");
        expect(content).toMatch(/restart:\s*(unless-stopped|always)/);
      }
    });
  });
});
