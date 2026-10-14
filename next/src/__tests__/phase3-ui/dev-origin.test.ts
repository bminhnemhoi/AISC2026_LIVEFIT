// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { blockCrossSiteDEV } = require("next/dist/server/lib/router-utils/block-cross-site-dev.js");
const configPath = new URL("../../../next.config.mjs", import.meta.url).pathname;

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });

it("allows HMR from only the configured HTTPS host and local development hosts", async () => {
  vi.stubEnv("LIVELIFT_APP_ORIGIN", "https://sandbox.example.com:8443");
  vi.resetModules();
  const { default: config } = await import(configPath);
  expect(config.allowedDevOrigins).toEqual(["127.0.0.1", "localhost", "sandbox.example.com"]);

  vi.spyOn(console, "warn").mockImplementation(() => {});
  const socket = { end: vi.fn() };
  const request = (origin: string) => ({ url: "/_next/hmr?id=regression", headers: { origin } });
  // This is the actual Next guard used before an HMR WebSocket upgrade.
  expect(blockCrossSiteDEV(request("https://sandbox.example.com:8443"), socket, ["localhost", "127.0.0.1"])).toBe(true);
  expect(blockCrossSiteDEV(request("https://sandbox.example.com:8443"), socket, config.allowedDevOrigins)).toBe(false);
  for (const origin of ["https://other.example.com", "https://child.sandbox.example.com", "null"]) {
    expect(blockCrossSiteDEV(request(origin), socket, config.allowedDevOrigins)).toBe(true);
  }
});

it.each(["http://sandbox.example.com", "https://sandbox.example.com/path", "https://*.example.com", "https://user:pass@sandbox.example.com"])(
  "rejects a non-exact HTTPS configuration: %s", async (origin) => {
    vi.stubEnv("LIVELIFT_APP_ORIGIN", origin);
    vi.resetModules();
    await expect(import(configPath)).rejects.toThrow("exact HTTPS origin");
  }
);

it("keeps local development available without a configured deployment", async () => {
  vi.stubEnv("LIVELIFT_APP_ORIGIN", "");
  vi.resetModules();
  const { default: config } = await import(configPath);
  expect(config.allowedDevOrigins).toEqual(["127.0.0.1", "localhost"]);
});
