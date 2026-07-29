# Stage log

Every stage is recorded here when its exit gate is walked, item by item. The format is
fixed (Part 0 §0.6):

```
## Stage NN — Name
Started: YYYY-MM-DD  Completed: YYYY-MM-DD
Exit gate: PASS | FAIL
Tests: N passing, 0 skipped. Coverage X% lines / Y% branches.
Deviations from manual: ...
Open questions raised: OQ-NNN (...)
```

A stage does not begin until the previous stage's entry here reads `PASS`.

---

## Stage 00 — Ground rules, repository, toolchain

Started: 2026-07-28 Completed: 2026-07-28
Exit gate: PASS
Tests: 9 passing, 0 skipped. Coverage not yet instrumented — wired in Stage 01, where
there is safety-critical code to hold to the §4.2 thresholds.

**Exit gate, walked item by item**

| Gate item                                                                                      | Result                                                                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`, `lint`, `typecheck`, `test`, `build` pass from a clean clone | PASS — verified locally and again on a clean CI checkout                                      |
| `pnpm verify:stage 00` exits 0                                                                 | PASS                                                                                          |
| `CLAUDE.md` exists and contains the eleven rules                                               | PASS                                                                                          |
| `.env.example` contains no values                                                              | PASS — asserted by a unit test and by the `forbidden-patterns` CI job                         |
| CI green on a test PR                                                                          | PASS — [PR #1](https://github.com/Sarah-JaneHarding/curriculum-saas-/pull/1), both jobs green |
| `docs/STAGE_LOG.md` has a Stage 00 entry                                                       | PASS — this entry                                                                             |

**What was built**

- pnpm workspaces + Turborepo, with the full §1.2 directory tree. Every package has a
  `package.json`, a `tsconfig.json` extending the root, and a `src/index.ts`.
- `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes` and `verbatimModuleSyntax`. Every package extends it and
  none relaxes a compiler option.
- ESLint flat config that mechanically enforces Part 0: bans `any`, `@ts-ignore` and
  unlinked `@ts-expect-error`; bans `.only`/`.skip`/`xit` in tests; bans provider SDK
  imports outside `apps/gateway/src/adapters`; bans `process.env` outside
  `packages/config`; bans `new PrismaClient()` outside `packages/db`; bans `BYPASS_*` and
  `SKIP_APPROVAL` identifiers.
- `packages/config`: a Zod-validated environment loader that throws
  `EnvironmentValidationError` at boot on a missing or malformed variable, with tests for
  the happy path and four failure paths, plus tests that `.env.example` holds names with
  empty values only and stays in step with the schema.
- Prettier, lint-staged, Husky pre-commit (lint + format staged) and pre-push (typecheck +
  unit suite).
- `docs/`: ARCHITECTURE, SECURITY, POPIA, AGENTS, PROMPTS, DEPENDENCIES, STAGE_LOG,
  OPEN_QUESTIONS, RUNBOOKS/ — each with a real first section.
- `CLAUDE.md` at the repository root, carrying the eleven rules, the escalation triggers,
  the Definition of Done, commit discipline and the forbidden-pattern list.
- GitHub Actions `ci.yml`: install → lint → format:check → typecheck → unit → build →
  stage gate, with a concurrency group and a 15-minute timeout, plus a
  `forbidden-patterns` job.
- `scripts/verify-stage.ts`, run as `pnpm verify:stage <NN>`. Gates are cumulative: a
  stage runs its own commands and every earlier stage's.
- `docs/DEPENDENCIES.md` records every Stage 00 dependency with its licence.

**Post-gate defect — git hooks were never installed**

Classified per §4.4. A `format:check` failure reached CI after the gate was recorded.

- **Symptom.** `pnpm format:check` failed on `docs/STAGE_LOG.md` in CI.
- **Root cause.** Not the unformatted file. Husky installs hooks only when the package
  root is also the git root; here the monorepo sits in `infinite-ai/` inside a host
  repository (OQ-001), so `pnpm install` printed ".git can't be found" and installed
  nothing. **The pre-commit hook had never run, on any commit.** Stage 00 step 5 was
  recorded as done on the strength of the config files existing, not on the hooks firing
  — the gate checked for the artefact rather than the behaviour.
- **Classification.** Missing test. Nothing verified that the hooks were installed and
  executing, so a silently absent safety net looked identical to a working one.
- **Fix.** `scripts/install-hooks.mjs` resolves the git root and sets `core.hooksPath`,
  working in both the subdirectory layout and the standalone-repository layout it moves to
  after spin-out. The hooks locate the package root from their own path, since a hook runs
  with the git root as its working directory. Verified by staging a deliberately
  misformatted file and confirming the hook fired and rewrote it before the commit was
  created.

The gate stays PASS: every gate item was and remains satisfied, and the CI job that caught
this is itself the backstop the manual asks for. The lesson is recorded rather than
smoothed over — a control that has not been observed working has not been verified.

Deviations from manual: none outstanding. The monorepo was initially scaffolded in a
subdirectory of another repository because repository creation was unavailable to the
session that built it; it now sits at the root of its own repository, with history intact,
and OQ-001 is resolved. The subdirectory arrangement is what caused the git-hook defect
recorded above, so the move removes that class of problem rather than merely tidying.

Open questions raised: OQ-001, OQ-002, OQ-003, OQ-004.

---

## Stage 01 — Data foundation, tenancy, Row-Level Security

Started: 2026-07-28 Completed: —
Exit gate: **NOT YET PASS** — five of six items met; coverage outstanding.

**Exit gate, walked item by item**

| Gate item                                         | Result                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Every tenant-owned table appears in the RLS suite | PASS — `rls-coverage.integration.spec.ts` diffs `information_schema` and `pg_policies` against `src/tables.ts`; 18 tables, 57 assertions |
| No export path to an unscoped client              | PASS — `export-surface.spec.ts` checks the export list by name _and_ structurally for anything carrying `$connect`                       |
| Seeds reproducible                                | PASS — seeded twice against real Postgres, row counts identical, ~17s per run                                                            |
| Encryption verified by reading the raw column     | PASS — ciphertext read as raw `bytea` contains neither the plaintext nor either of its words; the mirror test decrypts the same row      |
| Cross-tenant access impossible by construction    | PASS — 113 assertions as `app_rw`, plus `withTenant` itself proven against a live database                                               |
| `packages/db` line coverage ≥ 95% (§4.2)          | **NOT MET — 89.5%**                                                                                                                      |

**The coverage shortfall, stated plainly**

§4.2 requires ≥ 95% lines for `packages/db` as a safety-critical package. The unit tier
measures 89.5%. The remaining uncovered lines in `client.ts` are the lazy connection and
the transaction body, which cannot execute without a database — so the unit tier cannot
reach 95% by construction, and reaching it legitimately needs coverage merged across the
unit and Testcontainers tiers. That merge is not built.

The threshold in `vitest.config.ts` is set to 88, just under the current measurement, so a
regression fails. It is deliberately not set to 95, because a threshold the tier cannot
meet would either block every build or be quietly disabled — and the second is how
coverage requirements die. The gap is carried here rather than papered over.

**A real gap the coverage number exposed**

`client.ts` measured 12.8% before this was investigated. The isolation suite proved the
policies but drove them through `asTenant` in the test harness — a _mirror_ of
`withTenant`, not `withTenant` itself. The function every read and write is supposed to go
through (rule 5) had never been executed. `client.integration.spec.ts` now exercises the
exported function directly, including that its settings are transaction-local rather than
session-level, which is the property that makes connection pooling safe.

This is the argument for the §4.2 thresholds existing at all: the number was not the
problem, it was the symptom.

**Defects found by CI that local runs could not catch**

Six rounds, six distinct defects, every one in code that passed locally — this environment
has no Docker daemon and no Postgres server, so nothing touching a database can be run
before it is pushed.

1. `migrator` owned no schema the migrations targeted — an `app` schema was created while
   Prisma targeted `public`.
2. `CREATE SCHEMA IF NOT EXISTS "public"` needs database-level CREATE, which `migrator`
   deliberately lacks. Removed rather than granted.
3. The Prisma client was never generated in CI, so `@prisma/client` resolved to a stub.
   Fixed by generating on postinstall, which also makes the README's clean-clone promise
   true.
4. The seed's per-tenant transaction exceeded Prisma's 5s interactive default.
5. Two seed checks scanned across tenants — which RLS correctly refused. The isolation
   layer caught the test that forgot about it.
6. Seeded teacher emails were not campus-scoped, so a school group's two campuses
   collided on class 6A. Exactly the bug the two-campus fixture shape exists to surface;
   three single-campus tenants would have shipped it.

**A finding worth recording about the isolation model**

Once any transaction on a connection has called `set_config` for `app.tenant_id`, a later
context-less query on that same connection reads `''` rather than raising `unrecognized
configuration parameter`. It still fails closed — `''::uuid` is itself an error — but with
a different error than a connection that has never set the variable. The suite asserts
rejection rather than a message, so it holds either way, and neither path returns rows.
"Context-less queries raise a specific error" would have been an overclaim.

Deviations from manual: no Docker in the authoring environment, so every database
behaviour was written blind and proven only in CI. Coverage below §4.2 as described above.

Open questions: OQ-002 and OQ-003 still block Stage 08. OQ-004 answered in practice —
seeds are generic — but not formally closed.
