import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1, which lists Unit and Integration as separate layers.
//
// `pnpm test` runs the unit tier: pure logic, schema and source-level assertions that need
// no database and run on any machine.
//
// `pnpm test:integration` runs the Testcontainers tier: the RLS isolation suite and the
// live coverage assertion, which need a real Postgres. Both tiers run on every PR — the
// integration tier in its own CI job — so nothing is skipped and rule 2 holds. The split
// exists so that a developer without Docker gets a fast, honest unit run rather than an
// unexplained failure, and so the Stage 00 gate does not silently acquire a Docker
// dependency it never asked for.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // §4.2: packages/db is safety-critical. The threshold applies to the tenant client
      // and encryption; it is raised to 95 once the integration tier's coverage is merged
      // in, which needs Docker in CI to be meaningful.
      thresholds: { lines: 80, branches: 75 },
    },
  },
});
