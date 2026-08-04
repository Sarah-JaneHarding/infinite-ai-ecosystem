import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Not in §4.2's named safety-critical list, so held to the general floor rather
      // than the 95% bar packages/{policy,deident,guardrails,db} carry. `main.ts` and the
      // process-entry branch of index.ts are excluded — they are exercised by running the
      // service, not by a unit suite, the same reasoning packages/db applies to its own
      // Testcontainers-only paths.
      exclude: ['src/main.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 },
    },
  },
});
