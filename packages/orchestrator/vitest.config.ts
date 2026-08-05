import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1. `pnpm test` runs this one: the pure DAG declaration and
// state-machine logic, which need no database. `pnpm test:integration` is the
// Testcontainers-backed tier the runner itself needs, since it is the one thing here that
// actually calls into @infinite-ai/db. See vitest.integration.config.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
  },
});
