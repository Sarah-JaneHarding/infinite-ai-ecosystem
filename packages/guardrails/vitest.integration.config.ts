import { defineConfig } from 'vitest/config';

// Testcontainers tier — requires a Docker daemon. There is deliberately no skip path.
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
