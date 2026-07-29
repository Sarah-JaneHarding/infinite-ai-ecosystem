import { defineConfig } from 'vitest/config';

// The Testcontainers tier. Requires a Docker daemon; there is deliberately no skip path,
// because a silently skipped isolation suite is indistinguishable from a passing one
// (rule 2). Absence of Docker fails loudly.
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    // A container start plus a migration run is slow, and two suites each start one.
    testTimeout: 120_000,
    hookTimeout: 180_000,
  },
});
