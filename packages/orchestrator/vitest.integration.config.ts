import { defineConfig } from 'vitest/config';

// The Testcontainers tier. Requires a Docker daemon; there is deliberately no skip path,
// for the same reason packages/db's own integration tier has none (rule 2).
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    // A container start plus a migration run is slow — see packages/db's own comment.
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
