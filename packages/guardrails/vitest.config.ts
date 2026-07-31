import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // §4.2 lists this among the safety-critical packages at >= 95% lines. Everything in
      // it is pure and synchronous, so unlike packages/db there is no tier of behaviour
      // that can only run against a container — the threshold is reachable here and is set
      // to what the manual asks for rather than to what the suite currently happens to hit.
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
