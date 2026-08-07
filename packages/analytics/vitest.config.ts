import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // §4.2 lists analytics among the safety-critical packages at >= 95% lines. Every
      // decision here (tier assignment, legal transition validation) is pure and synchronous,
      // so unlike packages/db there is no tier of behaviour only a container can reach —
      // the threshold is reachable and is set to what the manual asks for.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
