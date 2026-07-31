import { defineConfig } from 'vitest/config';

// The §4.2 gate for packages/db, applied to the union of the unit and Testcontainers
// tiers.
//
// Stage 01 recorded its coverage item as NOT MET at 89.5%, with the reason stated plainly:
// the unit tier cannot reach 95% by construction, and doing so legitimately needs coverage
// merged across both tiers. This is that merge. Each tier writes a blob report; this config
// consumes both and applies the threshold once, to the whole package.
//
// Run via `pnpm --filter @infinite-ai/db coverage:merged`, which requires Docker because
// half the evidence comes from a real Postgres. There is no path that produces this number
// without running the isolation suite, which is the correct dependency: a coverage figure
// for this package that did not involve a database would be measuring the wrong thing.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
