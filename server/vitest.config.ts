import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Teardown in the heartbeat and liveness suites waits for background
    // runs to drain (up to 100 polls at 50ms) before truncating, then stops
    // embedded Postgres. Under CI load that legitimately exceeds vitest's
    // 10s default and surfaces as "Hook timed out" plus foreign-key noise
    // from runs still writing events mid-truncate.
    hookTimeout: 60_000,
    isolate: true,
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    pool: "forks",
    sequence: {
      concurrent: false,
      hooks: "list",
    },
    setupFiles: ["./src/__tests__/setup-supertest.ts"],
  },
});
