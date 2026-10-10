import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // ponytail: four workers bound memory on shared development hosts; raise when measured resources permit.
    maxWorkers: 4,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
