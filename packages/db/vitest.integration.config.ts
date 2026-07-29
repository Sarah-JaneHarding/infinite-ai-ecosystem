import { defineConfig } from 'vitest/config';

// The Testcontainers tier. Requires a Docker daemon; there is deliberately no skip path,
// because a silently skipped isolation suite is indistinguishable from a passing one
// (rule 2). Absence of Docker fails loudly.
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    // A container start plus a migration run is slow, and each suite starts one. The
    // seed suite is slower still: it loads roughly 2,300 learners with four upserts each,
    // and does it twice to prove the second run changes nothing. These ceilings are sized
    // for that, not for a unit test.
    testTimeout: 300_000,
    hookTimeout: 300_000,
    coverage: {
      provider: 'v8',
      // The same file set the unit tier measures, so the two blob reports merge into a
      // figure about one thing. No thresholds here — they belong to the merge, for the
      // reason set out in vitest.config.ts.
      include: ['src/**/*.ts'],
    },
  },
});
