# CLAUDE.md — read this first, every session

Condensed from PART 0 of `INFINITEAI_BUILD_MANUAL.md`. The manual is authoritative; this
file is what you read before touching anything. Regenerate it from Part 0 if Part 0 changes.

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
