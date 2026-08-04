import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1. `pnpm test` runs this one: pure logic that needs no
// database — extraction, the transition order, contradiction detection — and runs on any
// machine. `pnpm test:integration` is the Testcontainers tier the write-path orchestrator
// itself needs, since it is the one thing here that actually calls into
// @infinite-ai/db. See vitest.integration.config.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
  },
});
