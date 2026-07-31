import { defineConfig } from 'vitest/config';

// Two tiers, per Part 4 §4.1, which lists Unit and Integration as separate layers.
//
// `pnpm test` runs the unit tier: pure logic, schema and source-level assertions that need
// no database and run on any machine.
//
// `pnpm test:integration` runs the Testcontainers tier: the RLS isolation suite, the live
// coverage assertion and the POPIA ledger and erasure suites, which need a real Postgres.
// Both tiers run on every PR — the integration tier in its own CI job — so nothing is
// skipped and rule 2 holds. The split exists so that a developer without Docker gets a
// fast, honest unit run rather than an unexplained failure.
//
// **No coverage thresholds here, deliberately.** Roughly two-thirds of this package is
// code that cannot execute without a database: the transaction body in client.ts, the
// consent ledger's write path, erasure. A threshold on this tier alone would either be set
// low enough to be meaningless or block every build, and §4.2's 95% is a statement about
// the package, not about one tier of it. The thresholds live in vitest.merge.config.ts and
// are applied to the union of both tiers by `pnpm coverage:merged`. See docs/STAGE_LOG.md.
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    exclude: ['test/**/*.integration.spec.ts', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
