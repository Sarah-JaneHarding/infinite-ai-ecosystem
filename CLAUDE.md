# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

Read it first, every session. The rules below are condensed from PART 0 of
`INFINITEAI_BUILD_MANUAL.md`. The manual is authoritative; this file is what you read
before touching anything. Regenerate it from Part 0 if Part 0 changes.

## Commands

```bash
pnpm install                     # postinstall generates the Prisma client and installs git hooks
cp .env.example .env             # then fill it in locally; never commit it (rule 7)
pnpm lint                        # eslint . — also enforces most of the forbidden-pattern list
pnpm typecheck                   # turbo run typecheck (tsc --noEmit per package)
pnpm test                        # unit tier, every package, no Docker needed
pnpm test:coverage               # unit tier with §4.2 thresholds enforced per package
pnpm build
pnpm format / pnpm format:check
pnpm verify:stage <NN>           # cumulative stage gate; must exit 0 before the next stage
```

Local dev data plane (Postgres 16 + pgvector, Redis 7) — reads secrets from `.env`, none
have defaults, so an unconfigured machine fails to boot rather than starting with a
guessable password:

```bash
docker compose -f infra/docker/compose.dev.yml up -d
```

Narrowing a run — Turbo filters by package, Vitest by file or test name:

```bash
pnpm --filter @infinite-ai/policy test                  # one package
pnpm --filter @infinite-ai/policy test rbac-scopes      # files matching a substring
pnpm --filter @infinite-ai/policy exec vitest run -t "OWN_CLASS"   # one test by name
```

Database work (`packages/db`) — the integration tier needs a **Docker daemon**, which the
authoring sandbox does not have. Those suites are written blind and proven in CI:

```bash
pnpm --filter @infinite-ai/db db:generate        # regenerate the Prisma client after a schema edit
pnpm --filter @infinite-ai/db db:migrate:dev     # create a migration (needs a live database)
pnpm --filter @infinite-ai/db db:seed            # idempotent; a second run must be a no-op
pnpm --filter @infinite-ai/db test               # unit tier only
pnpm --filter @infinite-ai/db test:integration   # Testcontainers; real Postgres; no skip path
pnpm --filter @infinite-ai/db coverage:merged    # both tiers merged — the only honest coverage number for this package
```

`pnpm check:retention <schedule.json>` validates a school's filled-in retention schedule
(`docs/RETENTION_SCHEDULE_TEMPLATE.md`) before it is loaded.

Writing a migration that adds a **tenant-owned table**: `tenant` carries
`FORCE ROW LEVEL SECURITY`, so the foreign-key validation scan runs under the tenant policy
and fails with `42704` unless the migration sets a tenant context first. See the header of
`20260729160000_stage03_popia_tables/migration.sql` — it explains the fix and the four
alternatives that were rejected.

## Architecture

Nine layers. Data flows **up** through them, and each one is a chokepoint that the layer
above cannot go around — that is the whole design, and most of the rules below are just
that property restated.

```
L8 experience surfaces   apps/web · role-scoped UIs
L7 modules               MOD-01…MOD-05 · the product features
L6 agent runtime         packages/{agents,orchestrator,prompts} · DAGs, human gates
L5 guardrail plane       packages/{guardrails,policy,deident} · the last thing before a model
L4 Infinite Brain        packages/brain · five memory tiers, append-only
L3 data plane            packages/db · Prisma + RLS, tenant-scoped client
L2 model gateway         apps/gateway · the ONLY path to a provider
L0/L1 integrations       school systems, ratified policy sources
```

**Four invariants, each enforced in a specific file.** When something seems awkward, it is
usually one of these holding:

1. **Tenant isolation** — `packages/db/src/client.ts` exposes `withTenant()` and nothing
   else. It opens a transaction and sets `app.tenant_id` transaction-locally; every RLS
   policy reads it via `current_setting('app.tenant_id', false)`, the _raising_ form, so a
   context-less query errors rather than quietly matching nothing.
   `packages/db/src/tables.ts` classifies every table, and the RLS suite is driven off that
   list — a new table cannot escape the isolation proof without failing a test.
2. **No PII in a prompt** — `packages/guardrails/src/pii-guard.ts` checks
   _provenance first_: a payload without a `deidentified: true` stamp is refused even when
   the detector finds nothing. Tokenisation and scrubbing are `packages/deident`.
3. **Purpose limitation** — `packages/contracts/src/popia/purpose.ts` is one table saying
   which data categories each purpose may touch. `packages/policy/src/access.ts` applies
   three gates in a fixed order: tombstone → purpose allow-list → lawful basis. Purpose
   _before_ consent is deliberate; consent cannot widen a use the school never declared.
4. **Append-only ledgers** — `audit_event` and `consent_record` refuse UPDATE and DELETE by
   database trigger, listed in `APPEND_ONLY_TABLES`. Effective consent is derived by
   replaying entries (`packages/policy/src/consent.ts`), which is what makes "were we
   permitted to do this on the day we did it?" answerable.

**Policy is data, not code.** The RBAC matrix (`packages/policy/src/rbac.ts`), the purpose
table and the retention schedule are all declarative and read top-to-bottom. Compressing
them with loops or inheritance trades reviewability for brevity nobody needs. Retention
ships **no periods at all** — those are each school's legal determination (OQ-007).

**Two test tiers.** Unit runs anywhere; integration needs Docker and has no skip path,
because a silently skipped isolation suite is indistinguishable from a passing one.

## Where the state of play lives

- `docs/STAGE_LOG.md` — every stage's exit gate walked item by item, plus defects found
  and why. Read the tail before starting anything.
- `docs/OPEN_QUESTIONS.md` — what is blocked on a human. Add to it rather than guessing.
- `docs/POPIA.md` — the privacy invariants and the reasoning behind them.

## What this is

A multi-tenant SaaS platform sold to South African schools: the **Infinite Brain** (five
memory tiers), the **Learning Engine**, and five modules — MOD-01 Curriculum Engine,
MOD-02 Support Analytics Centre, MOD-03 Data Collection & Warehouse, MOD-04 Teaching &
Learning Toolbox, MOD-05 Teaching Analytics & PD Studio — all running behind a guardrail
and policy plane, on a model gateway, over a tenant-isolated data plane.

## The eleven rules you must never break

1. **Never skip a stage**, and never start one before the previous stage's Exit Gate
   passes. If a gate fails, fix it. Not "temporarily".
2. **Never disable, skip, delete or weaken a failing test to make CI green.** `.skip`,
   `.only`, `xit`, commented-out assertions and lowered thresholds are forbidden in
   committed code. Fix the root cause.
3. **No model call may bypass the Model Gateway.** No provider SDK imported by
   application code. The gateway's own adapters are the one exception.
4. **No learner personal information may enter a prompt.** Everything derived from
   learner data passes through the De-identification Service and carries
   `deidentified: true`. There is no escape hatch; do not add one.
5. **Every database read and write goes through the tenant-scoped client.** RLS is the
   second line of defence, not the first. A query that could run without a tenant context
   is a security bug.
6. **Human-in-the-loop gates cannot be bypassed in production.** No flag, no env var, no
   `SKIP_APPROVAL`. The approval record exists before the guarded transition commits.
7. **No secret in the repository, ever** — not in code, tests, fixtures, comments or
   `.env.example`. That file holds key _names_ with empty values only.
8. **TypeScript is strict.** No `any`, no `@ts-ignore`, no unlinked `@ts-expect-error`.
   `unknown` plus a Zod parse is the correct pattern.
9. **No new dependency without recording** name, version, licence, why, and what it
   replaces in `docs/DEPENDENCIES.md`. Nothing outside MIT / Apache-2.0 / BSD / ISC
   without explicit approval.
10. **No schema change without a forward migration and a tested rollback.** Destructive
    migrations need a separate, explicitly approved step.
11. **Nothing is destructively updated in the Brain.** Facts are superseded with a new
    version. Deletion happens only through the retention/tombstone path.

## Stop and ask the human

Write the question into `docs/OPEN_QUESTIONS.md` and stop when any of these is true:

- Two requirements in the manual conflict.
- A stage needs a credential, tenant, domain or third-party account you do not have.
- You are about to do something irreversible to data (drop, truncate, destructive
  migration, bulk delete).
- You are about to weaken a security or privacy control to make something work.
- A CAPS, ATP, SIAS or SACE rule is ambiguous and you would otherwise guess.
- A behaviour would need learner PII in a prompt.
- An exit gate cannot be met without changing the design.
- A stage's estimated cost exceeds its budget by more than 30%.

**Never invent curriculum policy, assessment weightings, SIAS process steps or CPTD point
values.** If it is not in a supplied source document, ask.

## Definition of Done — every task

- Strict TypeScript; `pnpm lint` and `pnpm typecheck` pass.
- Unit tests for the happy path **plus at least two failure paths**, passing.
- Touches tenancy, auth, PII or a guardrail → a dedicated security test exists and passes.
- Adds an API surface → a Zod schema defines the contract and a contract test asserts it.
- Adds an agent → registered, prompt versioned in the Prompt Registry, an eval set of
  ≥ 20 cases, and a cost budget.
- Emits a trace span, and where relevant a metric and an audit-ledger entry.
- The relevant file under `docs/` is updated **in the same commit**.
- The stage's cumulative test command still passes.

## Commit and PR discipline

- Conventional Commits: `feat(mod-01): add ATP sequencer agent`.
- One logical change per commit. Max ~400 changed lines per PR, excluding generated
  files, lockfiles and snapshots.
- Every PR body states: stage, task ID, what changed, how it was tested, which guardrails
  it touches.
- Never force-push to `main`. Never commit directly to `main`.
- Branches: `stage-07/eval-harness`, `fix/rls-leak-in-reports`.

## How to work a stage

1. Read the whole stage first. 2. Make a task list from its numbered steps, in order.
2. Implement step by step, committing when the tree is green. 4. Run the stage's
   Verification commands. 5. Walk the Exit Gate item by item and record it in
   `docs/STAGE_LOG.md`. 6. Only then start the next stage.

## Forbidden patterns

```
any                        @ts-ignore                  @ts-expect-error (unlinked)
.only  .skip  xit  xdescribe                           process.env outside packages/config
new PrismaClient() outside packages/db                 raw provider SDK outside apps/gateway
SKIP_APPROVAL / BYPASS_* flags                         UPDATE on a superseded Brain row
string concatenation into SQL                          secrets in fixtures or seeds
console.log in committed code (use the logger)         catch {} with an empty body
```

Most of these are enforced by `eslint.config.mjs` and the `forbidden-patterns` CI job.
If you find yourself wanting to silence one, that is the signal to stop and ask.

## Stage gate

```bash
pnpm verify:stage <NN>     # must exit 0 before the next stage begins
```

## What may never be added

A second path to a model provider · a way to read learner data without a purpose · a way
to approve an artefact without a human · a destructive write to the Brain · a cross-tenant
query on identifiable data. If a request needs one of these, refuse it, escalate, and
record the refusal in `docs/OPEN_QUESTIONS.md`.
