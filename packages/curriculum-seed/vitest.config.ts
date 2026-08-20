import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1. `pnpm test` runs this one: pure logic that needs no
// database. `pnpm test:integration` is the Testcontainers tier that proves the
// write path reaches AWAITING_RATIFICATION against a real Postgres instance.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
  },
});
