import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1, since `brain-age-appropriateness.ts` — added when the
// age-appropriateness ingestion gave OQ-015 real source material to query — is this
// package's first module that calls into @infinite-ai/db. `pnpm test` (this config) runs
// the rest of the package's pure, synchronous checks plus that module's mocked unit test;
// `pnpm test:integration` (vitest.integration.config.ts) is the Testcontainers tier that
// proves it against a real Postgres.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // §4.2 lists this among the safety-critical packages at >= 95% lines.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
