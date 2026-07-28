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

Deviations from manual: the monorepo lives in the `infinite-ai/` subdirectory of the host
repository rather than at the root of its own repository, because repository creation was
not available to the session that scaffolded it. `scripts/spin-out-repo.sh` moves it to
its own repository root unchanged. Recorded as OQ-001.

Open questions raised: OQ-001, OQ-002, OQ-003, OQ-004.
