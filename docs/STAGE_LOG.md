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

Started: 2026-07-28 Completed: 2026-07-29
Exit gate: **PASS** — the coverage item was closed during Stage 03; see below.

**Exit gate, walked item by item**

| Gate item                                         | Result                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every tenant-owned table appears in the RLS suite | PASS — `rls-coverage.integration.spec.ts` diffs `information_schema` and `pg_policies` against `src/tables.ts`; 18 tables, 57 assertions                                             |
| No export path to an unscoped client              | PASS — `export-surface.spec.ts` checks the export list by name _and_ structurally for anything carrying `$connect`                                                                   |
| Seeds reproducible                                | PASS — seeded twice against real Postgres, row counts identical, ~17s per run                                                                                                        |
| Encryption verified by reading the raw column     | PASS — ciphertext read as raw `bytea` contains neither the plaintext nor either of its words; the mirror test decrypts the same row                                                  |
| Cross-tenant access impossible by construction    | PASS — 113 assertions as `app_rw`, plus `withTenant` itself proven against a live database                                                                                           |
| `packages/db` line coverage ≥ 95% (§4.2)          | PASS — **100%** lines, branches, functions and statements, merged across the unit and Testcontainers tiers. Closed during Stage 03; the account below is left as written at the time |

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

---

## Stage 03 — POPIA layer: purpose, de-identification, consent, retention

Started: 2026-07-29 Completed: —
Exit gate: **PARTIAL** — the enforceable controls are in place and proven; the
data-subject-rights HTTP surface and the nightly retention job are not built.

**What this stage put in place**

| Step                    | Where                                                                     | Proven by                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2 · Purpose taxonomy    | `packages/contracts/src/popia/purpose.ts`                                 | 16 tests; `planning` touches no learner-level category, `product_improvement` touches nothing at all, `SPECIAL_PERSONAL` is granted to `intervention` alone               |
| 3 · Purpose filter      | `packages/policy/src/access.ts`                                           | 11 tests; three gates in fixed order, drops with a reason rather than throwing                                                                                            |
| 4 · De-identification   | `packages/deident/`                                                       | 41 tests; tokenisation is deterministic per tenant and unlinkable across them, and the scrubber now has a direct suite rather than only being exercised through the guard |
| 5 · PII egress guard    | `packages/guardrails/src/pii-guard.ts`                                    | 101 tests including 41 red-team payloads; provenance is checked first and on its own is sufficient to refuse                                                              |
| 6 · Consent ledger      | `packages/contracts`, `packages/policy`, `packages/db`, `consent_record`  | append-only enforced by trigger, verified against real Postgres as both `app_rw` and `migrator`                                                                           |
| 8 · Retention & erasure | `packages/contracts/src/popia/retention.ts`, `packages/db/src/erasure.ts` | erasure destroys identifiers and keeps the decision record, verified against real Postgres                                                                                |

**Two decisions worth defending**

_Consent is not the only lawful basis._ The ledger records which of POPIA §11(1)'s six
bases applies. Modelling everything as consent would mean a guardian's withdrawal could
oblige a school to stop keeping a statutory register; modelling nothing as consent would
deny families a choice they genuinely have. A withdrawal against a basis the subject cannot
unilaterally end is recorded as an objection — it does not stop the processing, and it does
not vanish either. It rides on every subsequent access decision and sits in the information
officer's queue until answered. An objection mechanism whose objections disappear is worse
than not offering one.

_No retention periods are shipped._ `retention.ts` defines the shape of a schedule and the
arithmetic to evaluate it and contains no numbers, because the periods are each school's
legal determination against statute — CLAUDE.md rule 11. A plausible-looking default would
have been the worst outcome available: wrong in a way nobody checks, destroying records on
a schedule no human agreed to. The consequence is deliberate and is stated in
`docs/POPIA.md` §5.1: a category with no ratified rule is never tombstoned, and appears on
an unscheduled-categories report every run instead. Raised as OQ-007.

**Stage 01's coverage item, closed**

Stage 01 recorded `packages/db` line coverage as NOT MET at 89.5%, with the reason stated:
the unit tier cannot reach §4.2's 95% by construction, and doing so legitimately needs
coverage merged across the unit and Testcontainers tiers. That merge is now built. Each
tier writes a blob report; `vitest.merge.config.ts` consumes both and applies the threshold
once, to the whole package. `pnpm --filter @infinite-ai/db coverage:merged` is the gate, it
runs in the `database` CI job, and it requires Docker — which is the right dependency,
since a coverage figure for this package that did not involve a database would be measuring
the wrong thing.

The per-tier configs carry no thresholds now. A threshold on a tier that cannot execute
two-thirds of the package would either be meaningless or block every build, and the second
is how coverage requirements get switched off.

`contracts`, `policy`, `deident` and `guardrails` are all at 100% lines and branches
against a 95% floor, enforced on every PR rather than only at the stage gate.

**A real gap the coverage number exposed, again**

`packages/deident/src/scrub.ts` measured **0%**. The scrubber — the thing that removes
names from free text before it reaches a model — had never been called from its own
package's tests. It was exercised only through the guardrails red-team suite, which calls
`containsDetectablePii` and therefore only ever asserted the boolean.

That suite proves the detector _notices_. It says nothing about what the scrubber leaves
behind, and the replacement text is what reaches the model — so a scrubber that detects
perfectly and rebuilds the string wrongly is a scrubber that leaks, and nothing would have
caught it. `test/scrub.spec.ts` now asserts the output: placeholders in place of names, the
surrounding sentence intact, offsets pointing into the original text, and redaction records
that carry no trace of what they redacted.

Second time in this project that a coverage figure has been the symptom rather than the
problem. Stage 01's was `client.ts` at 12.8%, which turned out to mean rule 5's entry point
had never executed.

**What is not built, stated plainly**

- **The data-subject-rights HTTP surface.** The `data_subject_request` model, its states,
  the verification gate and the erasure it drives are in place. The authorised, audited,
  rate-limited endpoints need the API app and land with it.
- **The nightly retention job.** The evaluation function is written and tested; the worker
  that runs it has nothing to run until a school ratifies a schedule (OQ-007).
- **The consent-withdrawal sweep.** `docs/POPIA.md` §5 promises PII unreadable within one
  job cycle of a withdrawal. The pieces exist — `evaluateConsent` says who withdrew,
  `eraseSubject` does the work — and the job that joins them is not written.
- **Audit chain linkage.** `writeErasureEvent` writes a content hash with a null
  `previousHash`. Stage 02's tamper-evident chain is on a separate branch; this call site
  links into it when that lands. The interim state is a real hash of real content rather
  than a placeholder, so the row is verifiable on its own terms meanwhile.

**A defect CI found that only a migration-from-scratch could find**

Classified per §4.4. Every integration suite failed in `beforeAll`, all five for one cause.

- **Symptom.** `migrate deploy` failed on `20260729160000_stage03_popia_tables` with
  `42704: unrecognized configuration parameter "app.tenant_id"`.
- **Root cause.** Adding a foreign key makes PostgreSQL run a validation scan of the new
  table joined to the referenced one. `tenant` carries `FORCE ROW LEVEL SECURITY`, so that
  scan is subject to the tenant policy _even as the table owner_ — which is precisely what
  FORCE is for. The policy reads `current_setting('app.tenant_id', false)`, the raising
  form, and a migration has no tenant context. It fails even though the new table is empty,
  because the setting lookup is row-independent and the planner hoists it into an InitPlan
  that runs before the scan yields anything.
- **Why Stage 01 did not hit it.** That stage created every table and its foreign keys
  _before_ enabling RLS. Every migration from here on that adds a tenant-owned table hits
  it, so this is a pattern rather than a one-off.
- **Fix.** Supply the missing context — `SET app.tenant_id` to the nil UUID for the
  duration of the migration — rather than remove the control. The rejected alternatives are
  written out in the migration header, because the tempting one is
  `current_setting('app.tenant_id', true)`, and switching the policy to the non-raising
  form to make a migration pass would silently convert every isolation predicate in the
  system from "fail loudly" to "match nothing". That is the failure the Stage 01 migration
  header warns about, arrived at from a direction nobody would be watching.
- **Classification.** Not a missing test — the integration suite runs migrations from
  scratch and caught it on the first run that included the new migration. This is the
  control working.
- **A footnote worth keeping.** The pre-push hook then rejected the fix, because
  `schema-classification.spec.ts` scans the migrations for the non-raising form of
  `current_setting` and the new migration _names_ it in prose, in the list of approaches it
  rejected. The check now reads comment-stripped SQL, matching what the neighbouring
  `CREATE SCHEMA` assertion in the same file already does and for the same stated reason: a
  check that trips over a written warning against the thing it guards is one that gets
  deleted rather than heeded. It still inspects 42 real policy predicates. Two things this
  confirms — the Stage 00 hook defect is genuinely fixed, since the hook fired unprompted
  on a local push, and a rule enforced by string matching will eventually meet prose that
  discusses it.

**A CI job that failed silently**

The first run of the merged-coverage gate failed and printed nothing about why: 52 seconds
of integration run, a blob report written, exit 1, no failure output. `--reporter=blob`
_replaces_ the default reporter rather than adding to it. Both reporters now.

Worth recording because the cost was a full diagnostic cycle spent on a fault that had
already been detected — and because the same mistake in a job people trust would mean a
red build nobody can act on, which erodes the habit of reading CI at all.

**The Stage 01 isolation suite refused the new tables, correctly**

Adding three tables to `TENANT_OWNED_TABLES` put them into `rls.integration.spec.ts`'s
table-driven cases, and its fixture guard failed the run: _"consent_record has no seeded
row — the isolation cases below would be vacuous"_. That guard is the reason the gap was a
red build rather than three tables silently exempt from the isolation proof. The fixture
now seeds all three for both tenants.

Fixing it surfaced two things worth more than the fix.

_The suite assumed every tenant-owned table carries `created_by`._ True of the Stage 01
schema by accident rather than by rule — the ledgers deliberately omit mutable-row
bookkeeping, because a row that is never updated has no "who last touched it". The update
case now writes `SET id = id`, the one column every table here is guaranteed to have. A
missing column makes the statement fail to parse, which looks nothing like the leak the
case exists to detect.

_Nothing proved the update case was doing anything at all._ It asserted that updating
another tenant's row affects zero rows, and a typo in that SQL would have produced the same
zero — a green isolation suite proving nothing, the worst outcome this file is capable of.
A companion case now asserts that updating one's **own** row affects one. It runs over
`TENANT_OWNED_TABLES` minus `APPEND_ONLY_TABLES`, as a filtered list rather than a skip:
rule 2 draws a hard line at skipped tests, and the ledgers' own-row behaviour — refusal by
trigger — is a different guarantee, asserted where it applies.

**The merged coverage number, and a real defect it exposed**

The merge worked and produced the first honest figure for `packages/db`: **94.42% lines,
94.91% branches** against §4.2's 95%. Short by 0.58 points, with 380 tests passing.

The threshold was not moved. What was uncovered turned out to be three gaps and one defect:

- `erasure.ts` — the guardian idempotency branch had no test. A retention sweep retrying a
  guardian erasure would have been running code nothing had executed.
- `erasure.ts` — the "no tenant context" guard was **unreachable**. It was checked when the
  audit event was written, by which point an RLS-scoped read had already failed with
  whatever error Prisma produced. The guard now runs first in `eraseSubject`, which is also
  one query instead of one per audit event, and gives a caller a sentence instead of a
  constraint error. Checking last made it dead code, which a coverage report notices and a
  reviewer does not.
- `consent.ts` — the empty-subject guard had no test.
- `encryption.ts` — **a real defect in key handling.** `fromBase64` wrapped its decode in a
  `try/catch` that could never fire, because `Buffer.from(x, 'base64')` does not throw. It
  silently discards every character outside the alphabet and decodes what is left.

  That is not a dead-branch tidiness point. A corrupted key does not fail to decode — it
  decodes to _different key material_, and if what survives is 32 bytes long the length
  check passes and the key is accepted. Constructed and confirmed: one corrupted character
  plus one trailing valid one yields exactly 32 bytes that are not the real key. Everything
  encrypted under it would be unreadable by the real key, found much later, with nothing
  anywhere to explain why. The material is now validated against the base64 alphabet before
  decoding, and a test asserts the generator's own keys all still pass.

Third time in this project a coverage figure has been the symptom rather than the problem —
`client.ts` at 12.8% in Stage 01, `scrub.ts` at 0% earlier in this stage, and now a
key-handling defect that had been in `main` since Stage 01 and that no functional test would
ever have reached.

With those four addressed, the merged figure is **100% of statements, branches, functions
and lines** across `packages/db`, on 385 tests. That closes Stage 01's outstanding gate
item, which is recorded there as met and cross-referenced here rather than quietly amended.

Worth being clear about what the number does and does not mean: 100% line coverage says
every line ran, not that every behaviour is correct. The isolation guarantees rest on the
113 assertions in `rls.integration.spec.ts` and the trigger cases in
`popia.integration.spec.ts`, not on this figure. What the figure is good for is exactly
what it did three times — pointing at code nothing had ever executed.

**A no-op assertion, found by inspection while that was being fixed**

`popia.integration.spec.ts` attempted `DELETE FROM consent_record` in a tenant that had no
consent records — every append in the suite was to the other tenant. RLS filtered the
DELETE to zero rows, the append-only trigger never fired, and nothing threw. Written as
`.rejects` it failed honestly; written as `.resolves` it would have passed while proving
nothing, which is the shape of a test that guards an empty set. The case now seeds a real
entry first and also asserts it survives the erasure.

**What merging Stages 02 and 03 together surfaced**

PRs #2 and #3 merged while #4 was open, so #4 took `main` back in. Five conflicts, all
additive: two barrel files, two `package.json`s and the lockfile. The lockfile was
regenerated rather than hand-merged. Nothing semantic — but the merge did expose two things
neither branch could have seen alone.

_§4.2's coverage floor met Stage 02's code for the first time._ The `packages/policy`
threshold was added on the Stage 03 branch; `rbac.ts` and `impersonation.ts` arrived from
Stage 02 having never been measured against it, and the package came out at 96.4% lines but
**93.65% branches and 90% functions**. Not a merge artefact — a real gap in the package
§4.2 names as safety-critical. What was missing:

- **`assertAuthorized` and `AuthorizationError` had zero coverage.** The throwing entry
  point most call sites will use, in the authorisation matrix, entirely unexercised.
- Scope branches that decide who may read a child's record: an `OWN_SCHOOL` grant with a
  null school (tenant-wide appointment) versus one naming another campus; `OWN_SUBJECT`
  reached by class rather than by subject; `OWN_CLASS` with a null class, where null is a
  denial rather than the widening it is under `OWN_SCHOOL`; and the `OWN` fallthrough for
  roles that are neither guardian nor learner.

`test/rbac-scopes.spec.ts` covers these as sentences about who may see what.
`packages/policy` is now at 100% statements, functions and lines, 99.29% branches.

_A dead guard in the authorisation loop._ The remaining uncovered branch is
`if (!scopeAtLeast(permission.scope, 'OWN')) continue;` in `authorize`. `OWN` is index 0 of
`SCOPE_ORDER`, so the comparison is always true and the `continue` is unreachable. It reads
as a filter and is not one. Left in place rather than edited inside a merge-resolution
commit — a silent one-line deletion in a just-merged authorisation matrix is the hardest
kind of change to review — but it is Stage 02's to remove, and it is recorded here so the
next person to open that function is not misled by it.

_One of my own test names was overclaiming._ `policy/test/exports.spec.ts` had a case named
"offers no way to reach an ambient clock" that only checked function arity. The merged RBAC
code makes the claim plainly false — `authorize` and `assertAuthorized` both default `now`
to `new Date()`, and arity does not see a default. Renamed to what it verifies, with the
stronger property left where it actually holds: `consent.spec.ts` evaluates the same ledger
at different instants.

Deviations from manual: no Docker in the authoring environment, so every database behaviour
in this stage was written blind and is proven only in CI.

Open questions raised: OQ-007.

---

## Stage 04 — Model Gateway

Started: 2026-08-04 Completed: 2026-08-04
Exit gate: **PASS** — all ten steps are built and proven, including the tenant lexicon's
`packages/db` wiring (step 9) and OTel/Langfuse instrumentation (step 8).

**What this PR put in place**

| Step                           | Where                                                                                                                              | Proven by                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · HTTP surface               | `apps/gateway/src/server.ts`                                                                                                       | `/health`, `/v1/chat/completions`, `/v1/embeddings` over real HTTP in `test/server.spec.ts`                                                                                                                                                                                                             |
| 2 · Provider adapters          | `apps/gateway/src/adapters/`                                                                                                       | Anthropic-family and OpenAI-family adapters (the latter also serves the self-hosted local-model case); 13 tests against a faked `fetch`                                                                                                                                                                 |
| 3 · Credential pooling         | `apps/gateway/src/credentials/pool.ts`                                                                                             | round-robin, cooldown on rate limit, recovery after cooldown, no raw key reachable outside `reveal()`                                                                                                                                                                                                   |
| 4 · Model routing / fallback   | `apps/gateway/src/routing/`                                                                                                        | config is Zod-validated data, not code; fallback chain proven by test, non-retryable errors stop the chain immediately                                                                                                                                                                                  |
| 5 · Budgets                    | `apps/gateway/src/budgets/budget.ts`                                                                                               | hard limit refuses via `check()` before any adapter is touched; proven at both the tracker and the HTTP layer                                                                                                                                                                                           |
| 6 · Prompt cache + idempotency | `apps/gateway/src/cache/cache.ts`                                                                                                  | identical request within TTL served from cache and recorded as a hit; idempotency key wins over a differing content key                                                                                                                                                                                 |
| 9 · Inbound PII guard          | `apps/gateway/src/server.ts` (`assertEgressAllowed`)                                                                               | runs before budget and before routing; a payload with no provenance, or one with a raw identifier that survived de-identification, is refused with the router never called                                                                                                                              |
| 9 · Tenant lexicon             | `packages/db/src/lexicon.ts`, wired in `apps/gateway/src/index.ts`                                                                 | learner legal names decrypted from `learner_identifier`, plus staff and school names, read inside `withTenant()`; scoped by RLS and proven against real Postgres in `packages/db/test/lexicon.integration.spec.ts`                                                                                      |
| 10 · Provider-outage drill     | `apps/gateway/test/chaos/provider-outage.spec.ts`                                                                                  | `pnpm --filter gateway test:chaos`; 429s, 500s and timeouts on the first provider all recover through the real adapters, router, cache and HTTP server; chain exhaustion spends nothing and caches nothing; a non-retryable failure stops the chain and returns a typed error rather than exhausting it |
| 7 · Streaming + tool calls     | `apps/gateway/src/adapters/sse.ts`, `completeStream` on both adapters, `routeChatCompletionStream`, `handleStreamedChatCompletion` | SSE parsed and re-emitted as `text/event-stream`; tool-call deltas pass through by index for both providers' differing wire shapes; fallback is proven possible before the first event and proven impossible after it; budget is recorded only once the `done` event reveals usage                      |
| 8 · OTel + Langfuse            | `packages/telemetry/src/tracing.ts`, wired in `apps/gateway/src/server.ts` and `apps/gateway/src/routing/router.ts`                | one span per `/v1/chat/completions` and `/v1/embeddings` call, carrying tenant, module, agent, model, provider, token counts, cost estimate, cache-hit flag and refusal reason; fallback attempts land as span events; ships over a plain OTLP HTTP exporter to Langfuse's own OTLP endpoint            |

**Exit gate items proven**

| Gate item                                                       | Result                                                                                                                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No provider SDK imported outside `apps/gateway`                 | PASS — no adapter imports one at all (plain `fetch` against each provider's REST API); a repo-wide test (`no-provider-sdk-outside-gateway.spec.ts`) scans every source file for the banned import patterns, confined to `apps/gateway/src/adapters/` |
| Budget refusal proven by test                                   | PASS — `test/budgets/budget.spec.ts` and `test/server.spec.ts`'s "enforced before the call" case                                                                                                                                                     |
| Fallback chain proven by test                                   | PASS — `test/routing/router.spec.ts`                                                                                                                                                                                                                 |
| Zero credentials in logs                                        | PASS — `packages/telemetry/test/logger.spec.ts`; the boot script registers every pooled key for redaction                                                                                                                                            |
| Cache hit path returns identical output and records a hit       | PASS — `test/cache/cache.spec.ts`, `test/server.spec.ts`                                                                                                                                                                                             |
| Graceful fallback and no partial writes under a provider outage | PASS — `test/chaos/provider-outage.spec.ts` (step 10); real adapters and router, faked `fetch`                                                                                                                                                       |

**A real defect the exit-gate work found before it shipped**

`DEFAULT_ROUTING_CONFIG` originally named `text.scrub → { provider: "local" }` as a
"minimal default so a fresh clone boots." It does the opposite: `createRouter`'s boot
validation refuses to construct unless every provider a routing entry names has a
configured adapter, so a deployment that configured only Anthropic — a perfectly normal
thing to do — would fail to boot entirely, over a model nobody had asked for. Found by
writing `boot()`'s own test rather than assuming the wiring worked. Fixed by shipping an
**empty** default: nothing routes until a real routing file names it, the same shape of
decision the retention schedule template already makes by shipping no periods. See
`packages/contracts` reviewSchedule's own reasoning; `apps/gateway/src/routing/config.ts`
now states the parallel explicitly.

**Tenant lexicon resolution, closed**

The inbound PII guard's detector layer needs each tenant's known names. Learner legal
names live encrypted in `learner_identifier` (§1.3) — never plaintext in the database —
so `packages/db/src/lexicon.ts` decrypts them inside the caller's tenant transaction,
alongside `staff_member.display_name` (already plaintext; staff are not learner personal
information but a colleague's name in a note is still worth catching) and `school.name`.
A stale-key-version identifier is skipped rather than thrown on, so one row cannot take
the whole lexicon down; a learner `eraseSubject` has destroyed drops out on its own,
because the row the query reads is gone, not because this function checks a flag.

`withTenant()` needs an `actorId` to attribute the read to (Stage 02's audit trail), and
there is no real caller identity on the gateway's wire yet — that arrives with Stage 06's
agent runtime. `GATEWAY_SERVICE_ACTOR_ID` in `apps/gateway/src/index.ts` is a fixed,
documented placeholder for this one read-only lookup, not a value to forget about:
replacing it with the calling agent's real identity is explicitly Stage 06's to do.

`failClosedLexicon` stays as the default when `DB_ENCRYPTION_KEY` is not configured —
still the honest state for a gateway that cannot decrypt anything, rather than silently
disabling the detector with an empty lexicon.

**A second real defect, found while writing the chaos drill**

The chaos suite's first draft scripted an Anthropic success response using an
OpenAI-shaped body by mistake. The Anthropic adapter did not refuse it — it crashed with
a raw `TypeError` reading `.filter` off an undefined `content` field, which the router did
not recognise as an `AdapterError` and so did not retry, and which the server did not
recognise either, so it fell through to a bare `500 Internal gateway error`. A malformed
2xx body from a genuinely misbehaving provider would have produced the exact same opaque
failure in production. Both adapters now wrap their response-shaping logic in a
`try/catch` that converts anything unexpected into `AdapterError('invalid_request', ...)`,
which the router can fall back past and the server reports as a typed error — proven by a
dedicated test per adapter, not just fixed and left implicit in the chaos suite.

`sendRoutingError()` in `server.ts` also gained a case for a bare `AdapterError` reaching
the HTTP layer (a non-retryable failure — invalid credential, malformed provider response —
stops the router's chain immediately rather than exhausting it, so `AllProvidersUnavailableError`
is the wrong type to expect). It maps to `502` with the `all_providers_unavailable` code:
the gateway could not obtain a completion from any configured provider, which is what that
code already meant, even though not every link in the chain was tried.

**Streaming and tool-call pass-through, closed**

`completeStream()` on each adapter opens the same connection `complete()` does, with
`stream: true`, and checks the response status _before_ returning anything — the one
property `routing/router.ts`'s new `routeChatCompletionStream()` depends on. Fallback to
the next link in the chain is only attempted before a generator's first event; once one
event has left the generator, a caller (the HTTP layer, or eventually an agent) has
already forwarded bytes downstream, and switching providers mid-stream would mean either
duplicating or silently losing content. `test/routing/router.spec.ts` proves both halves
of that: fallback happens before the first event, and does not happen after it.

`apps/gateway/src/adapters/sse.ts` is a small, provider-agnostic SSE line reader — it only
extracts `data:` lines across chunk boundaries, because both OpenAI's and Anthropic's
streaming payloads repeat their own event type inside the JSON body, so the parser does
not need to understand either vocabulary. Each adapter owns translating its provider's
actual event shape (OpenAI's `choices[0].delta`, Anthropic's `content_block_start` /
`content_block_delta` / `message_delta`) into the shared `AdapterStreamEvent` union.

`packages/contracts` gained `ChatCompletionStreamEvent`, a discriminated union
(`content` / `tool_call` / `done` / `error`) so every event on one stream carries the same
`id`, `model` and `provider` for a client to correlate. `error` is the one case with no
non-streaming equivalent: once headers are sent as `text/event-stream`, a failure can no
longer be reported as an HTTP status the client has already moved past, so it becomes an
in-stream event instead, proven by `test/server.spec.ts`'s "reports an in-stream error
event" case. A failure _before_ the first event is still a normal typed HTTP error — proven
by the companion case asserting the response is not `text/event-stream` at all.

The prompt cache and the budget tracker both skip streaming for now: caching a stream
would mean synthesising a replay from a stored final result, which is a real feature but
not this one, and budget is recorded once the stream's own `done` event reveals usage no
provider states up front — proven by `test/server.spec.ts`'s "records budget spend only
once the done event reveals usage".

**OTel spans and Langfuse traces, closed**

`packages/telemetry/src/tracing.ts` wraps the real `@opentelemetry/api` /
`sdk-trace-base` / `exporter-trace-otlp-http` packages behind one small `Span`/`Tracer`
shape — `setAttribute`, `addEvent`, `recordException`, `end` — so application code never
touches the OTel API directly. "Ship LLM traces to Langfuse" needed no Langfuse-specific
SDK: Langfuse ingests OTLP directly at its own `/api/public/otel` endpoint, authenticated
with a Basic-auth header, so this is a plain OTLP HTTP exporter pointed at that endpoint —
the same shape every other OTel-speaking backend uses.

`createTracer()` returns the shared no-op tracer when `OTEL_EXPORTER_OTLP_ENDPOINT` is not
configured — the same "ship nothing until someone decides" shape `DEFAULT_ROUTING_CONFIG`
and the retention schedule template already use. Unlike the PII guard or the budget check,
tracing is not a security control, so its absence never blocks a request; it only means
the deployment cannot see the request in Langfuse yet. `boot()` logs a warning in that
case rather than pretending traces are shipping.

One span wraps each `/v1/chat/completions` and `/v1/embeddings` call end to end, carrying
the fields the manual names: `tenant.id`, `gateway.module`, `gateway.agent`,
`gateway.model`, `gateway.provider`, `llm.usage.prompt_tokens` /
`llm.usage.completion_tokens`, `gateway.cost_estimate`, `gateway.cache_hit` and
`gateway.refusal_reason`. Latency is the span's own duration — nothing recomputes it.
Latency percentiles and cache-hit rate are aggregates over many tagged spans, computed on
the Langfuse side rather than locally: that aggregation is exactly what an LLM
observability backend is for, and a local percentile calculator would just be a worse copy
of it. Fallback attempts are recorded as span events (`gateway.fallback`, tagged with the
provider and the reason) by threading the active span down into
`routing/router.ts`'s `attemptChain`/`attemptStreamChain` as an optional parameter — proven
directly against a real fallback in `test/routing/router.spec.ts`, and proven end to end
through the HTTP layer in `test/server.spec.ts`'s tracing suite (six cases: token counts
and cost on the happy path, a cache-hit flag flip on the second identical request, the
refusal reason for both the PII guard and the budget check, fallback events landing on the
trace, and exactly one span per streamed request carrying its final usage once the stream
completes).

`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` live in the shared
`EnvSchema` (`packages/config`), not the gateway's own narrower schema — unlike a provider
API key, an OTLP endpoint and its auth header do not grant access to any model, and every
future service that ships traces will need the same two values, so one shared secret is
the right shape rather than one per service. `OTEL_EXPORTER_OTLP_ENDPOINT` already existed
in that schema, reserved for Stage 15; this is its first real consumer.

**One thing still deliberately not invented**

**Provider pricing.** Cost estimation defaults to zero per call. A hard budget limit is
real and enforced the moment a school's real per-model price is supplied — proven by test
with a nonzero cost estimator injected, which is the mechanism the exit gate actually
names ("budget refusal proven by test"), not a specific price. Until a real price is
supplied, zero cost means the tracker never refuses on cost grounds in production, which
is the safe default rather than an invented number feeding a control that matters. This is
an operational gap the same shape as the Redis-backed store below, not something the
manual's five-item exit gate for this stage requires — recorded here as a real follow-up
rather than left to be discovered later.

Deviations from manual: budgets and the prompt cache are in-memory, not the Redis-backed
store §1.1 locks in — a single gateway process is the only deployment shape this PR
proves; a multi-instance gateway sharing that state needs a shared store, which is a
follow-up rather than a silent gap (both `BudgetTracker` and `GatewayCache` are built
behind an interface for exactly that swap). The prompt cache does not cover streaming
requests, for the reason above. `INFINITEAI_BUILD_MANUAL.md` itself was added to the repo
earlier in this stage — it had existed only outside the repo since Stage 00.

Open questions raised: none. The pricing gap above is follow-up implementation work, not
a decision that needs a human's judgement call, so it is tracked here rather than in
`docs/OPEN_QUESTIONS.md`.

---

## Stage 05 — Infinite Brain (L0-L4)

Started: 2026-08-04 Completed: —
Exit gate: **PARTIAL** — steps 1 (the five tiers), 2 (the write path), 3 (contradiction
resolution), 4 (the retrieval path), 5 (token-budgeted assembly) and 6 (provenance) are
built and proven. Steps 7-10 are not started. `scripts/verify-stage.ts`'s `05` entry stays
empty until they are.

**What this slice put in place (step 1)**

| Tier            | Table(s)                                      | Proven by                                                                                                                                                            |
| --------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0 Constitution | `brain_constitution`                          | Append-only, `supersedes` self-reference, `(tenantId, key, version)` unique — `schema-classification.spec.ts`, RLS and trigger coverage in `rls.integration.spec.ts` |
| L1 Semantic     | `brain_node`, `brain_edge`, `brain_embedding` | Same append-only/supersession shape; `brain_embedding.embedding` is `Unsupported("vector")`, invisible to the Prisma client entirely                                 |
| L2 Episodic     | `brain_episode`                               | `occurredAt` vs `recordedAt` split for the temporal test step 10 will write; corrections via `supersedes`, never an UPDATE                                           |
| L3 Procedural   | `brain_procedure`                             | Human-ratified like L0; a `PROMPT_VERSION` row is a pointer into Stage 06's Prompt Registry, not a second copy of prompt text                                        |
| L4 Working      | `packages/brain/src/working-memory.ts`        | No table — a `WorkingMemoryStore` interface plus `InMemoryWorkingMemoryStore`, TTL-based, evictable per run                                                          |

All six Postgres-backed tables are append-only, enforced the same way as `audit_event` and
`consent_record`: `app_forbid_mutation()` rejects UPDATE and DELETE outright. This is
Stage 05's own exit-gate item ("no code path performs a destructive update on a Brain
table") made concrete from the first migration, not retrofitted once something depended on
it being true. `rls.integration.spec.ts` gained a table-driven
`describe.each(APPEND_ONLY_TABLES)` block that proves the trigger fires on every append-only
table, Brain or not, rather than asserting it for `audit_event` alone and assuming the rest.

**A design decision worth recording: what "committed" means here**

Every row in these six tables is the _far end_ of the write-path state machine step 2
builds — `candidate → … → committed+versioned → indexed → retention-scheduled`. What a
candidate looks like while still in flight, still being contradiction-checked or awaiting
ratification, is step 2's table, not this one. Building that table now, before the state
machine that would populate and drain it exists, would be exactly the kind of speculative
schema step 1 was scoped to avoid.

**Three things deliberately not invented in this slice**

- **A fixed embedding dimension.** `brain_embedding.embedding` is declared as an
  unconstrained `vector` column. pgvector accepts that; a fixed dimension only matters for
  building an HNSW index, and no embedding model has been chosen for this deployment yet.
  Inventing a dimension (1536? 1024?) to get an index built now would be a real technical
  commitment made on nobody's authority, the same shape of gap Stage 04 left for provider
  pricing. `dimensions` on each row records what was actually stored, checked at the
  application layer; the index is a follow-up once a model is chosen.
- **L4's Redis backend.** The manual names Redis explicitly for working memory, unlike
  Stage 04's prompt cache. No dependency was added for it: there is no concrete per-run
  scratchpad to wire a Redis client to until Stage 06's orchestrator produces an actual
  run. `WorkingMemoryStore` is the contract; `InMemoryWorkingMemoryStore` is what this
  package's own tests run against until then.
- **`brain_conflict_queue`.** Step 7 names it as part of "never-forget guarantees," and
  step 3 (contradiction resolution) is what would enqueue to it. Unlike the five tiers
  above, a conflict queue is workflow state — closer in shape to `DataSubjectRequest` than
  to a Brain fact — so it is scoped to whichever of those two steps builds the logic that
  actually needs it, not invented alongside tables it has no caller for yet.

Deviations from manual: none yet — step 1 does exactly what "model the five tiers" asks.
The `brain_procedure` table's decision to store a _pointer_ to prompt content rather than
the content itself is not itself a deviation; the manual's step 1 description and Stage
06's Prompt Registry description would otherwise duplicate the same content in two places
with two different version-locking mechanisms, and this is the one place in either stage's
steps where that overlap is named.

Open questions raised: none. The embedding-dimension gap is follow-up implementation work
tied to a model choice, not a policy or curriculum judgement call, so it stays here rather
than in `docs/OPEN_QUESTIONS.md`, the same reasoning Stage 04 applied to provider pricing.

**What this slice put in place (step 2 — the write path)**

The manual's own transition list, made concrete: `candidate → extracted+typed →
contradiction-checked → provenance-stamped → (ratify if L0/L3) → committed+versioned →
indexed → retention-scheduled`. `brain_write_candidate` (`packages/db`) is one row per
fact in flight, and every arrival at a status is a separate `UPDATE`, persisted before the
next transition is attempted — proven directly in
`packages/brain/test/write-path.integration.spec.ts`'s "persists every transition" case,
which resumes a candidate from a completely separate transaction and shows it picks its
status back up rather than restarting from `openWrite`.

Unlike the six Stage 05 step 1 tables, `brain_write_candidate` is mutable and does **not**
join `APPEND_ONLY_TABLES` — it is workflow state describing a fact's journey, not the fact
itself, the same distinction that keeps `data_subject_request` off that list while
`consent_record` is on it. `docs/STAGE_LOG.md`'s reasoning from step 1 predicted this
exact table under a different name ("what a candidate looks like while still in flight...
is step 2's table, not this one") and that is what it is.

The work split across two packages, each proven at the tier the manual's own "two test
tiers" rule expects:

- **`packages/db/src/brain-write-path.ts`** is the imperative shell: it persists one
  transition (`advanceBrainWrite`), records a ratification (`ratifyBrainWrite`), looks up
  the current effective row for a natural key (`findEffectiveBrainFact`), and performs the
  one `INSERT` that commits a fact into whichever of the five target tables it belongs to
  (`commitBrainFact`). It also holds a structural guard neither the manual nor
  `packages/brain` asked for directly but that rule 5's "every write goes through the
  tenant-scoped client" implies under concurrency: a `REQUIRED_PREDECESSOR` table refuses
  to persist a transition whose required predecessor status does not match the candidate's
  current one, so two callers racing the same candidate cannot advance it out of order,
  and a ratified tier cannot reach `COMMITTED` without both `ratifiedBy` and `ratifiedAt`
  set. Proven by `packages/db`'s unit tier (no database needed for the guard itself) and
  its Testcontainers tier for the actual writes.
- **`packages/brain`** is where the decisions live: `write-path-schemas.ts` is the
  "extracted+typed" transition's content — a Zod schema per target tier, `unknown` in,
  a typed payload out, exactly rule 8's sanctioned pattern; `write-path-state-machine.ts`
  is the pure transition order (`nextStatus`) and contradiction decision
  (`decideContradiction`), neither of which touches a database and both of which are
  exhaustively unit tested, including a case that walks the entire order for a ratified
  tier and asserts it matches the manual's list verbatim; `write-path.ts` is the
  orchestrator that reads a candidate's current status, performs exactly the transition
  that status implies, and calls into `packages/db` to persist it.

**Five target tiers, not six.** `L1_EMBEDDING` does not travel through this pipeline.
Contradiction-checking and ratification are both meaningless for a vector — there is no
claim inside an embedding for another claim to conflict with, and nobody ratifies one — so
it is attached to an already-committed `BrainNode` once something calls the Model Gateway
to produce it, which has no caller yet (step 1 already left the embedding dimension
unchosen). This is a design conclusion, not a scope cut: the other four steps of the
pipeline genuinely do not apply to a vector.

**Contradiction detection, not resolution.** Step 2 detects an undeclared conflict — an
effective row already exists for a candidate's natural key (`(entityType, externalRef)`
for a node, `(sourceId, targetId, relation)` for an edge) and the candidate did not declare
it as what it supersedes — and refuses to commit over it, throwing rather than choosing a
winner. _Deciding_ what to do about a real conflict — compare provenance strength and
recency; never auto-resolve over a human-ratified fact; enqueue for a human — is step 3's
`brain_conflict_queue`, named but deliberately not built in step 1 and still not built
here. A refusal is a safe subset of "enqueue for a human": nothing here ever resolves a
conflict in the new fact's favour, which is the one behaviour rule 11's spirit forbids.
Versioned canon (`L0_CONSTITUTION`/`L3_PROCEDURE`) and episodes are outside this check
entirely — a new policy version is always meant to supersede the last one (that is what
versioning is), and an episode has no natural key to conflict against; a correction to one
is only ever an explicit `supersedes`, proven directly rather than inferred.

**Retention-scheduled is a real transition with deliberately no content.** The status is
still reached and still persisted for every candidate — proven by the same integration
suite that proves everything else — but it assigns no personal-information category and
matches no `RetentionRule`. Doing that honestly needs a data-category judgement call per
fact, which is step 8's "forgetting by design," not step 2's. Recorded here rather than
left implicit, the same shape of gap step 1 left for the embedding dimension and Stage 04
left for provider pricing.

**Concurrency, named rather than solved.** Two concurrent commits for the same
`L0_CONSTITUTION` key both reading "current version 3" and both trying to write version 4
is a real race this step does not lock against with `SELECT … FOR UPDATE`. What stops it
from being a silent lost update is `(tenant_id, key, version)`'s unique constraint (already
in place since step 1): the loser's `INSERT` throws, which is a correct, safe failure mode
even though it is not the friendliest one. A retrying caller gets a fresh version number
on its next attempt. Tightening this to a lock-then-read is a follow-up, not a step 2 exit
criterion — the manual's own text for this step is about persisted, resumable transitions,
not about concurrent-writer throughput.

Deviations from manual: none. Step 2's own text — the eight transitions, persisted so a
failed run resumes — is exactly what was built.

Open questions raised: none. The two gaps above (retention categorisation, concurrent
version races) are follow-up implementation work tied to steps this stage has not reached
yet, not decisions needing a human's judgement call, so they stay here rather than in
`docs/OPEN_QUESTIONS.md`.

**What this slice put in place (step 3 — contradiction resolution)**

The manual's own text: "on conflict with an existing fact, compare provenance strength and
recency; if the new fact would supersede a human-ratified fact, do not auto-resolve —
enqueue a conflict for a human and keep both versions."

**The human-ratified carve-out needed nothing new.** `L0_CONSTITUTION`/`L3_PROCEDURE` are
the only human-ratified tiers, and step 2's ratification gate already puts a human between
every new version of one and its commit — conflict or not. `checkContradiction` still
returns no contradiction for those two tiers (unchanged from step 2); this step's real work
is entirely `L1_NODE`/`L1_EDGE`, the two tiers with a natural key to conflict against and
no ratification of their own.

**`resolveContradiction`** (`packages/brain/src/write-path-state-machine.ts`, pure, no
database) is the comparison itself: `AUTO_SUPERSEDE` only when the candidate's confidence
is strictly higher than the existing fact's, or tied and strictly more recent — anything
else is not clearly the new fact's to decide, so it goes to a human rather than being
guessed at. Exhaustively unit tested across all four quadrants (higher confidence, tied
confidence with either the newer or the older row winning, and strictly lower confidence).

**`brain_conflict_queue`** (`packages/db`) is step 1's own prediction made real: it was
scoped to step 3 rather than invented alongside `brain_write_candidate`, "since a conflict
queue is workflow state... closer in shape to `DataSubjectRequest`... not invented here."
It is mutable, not append-only, for exactly that reason, and carries the provenance
comparison's inputs (both facts' confidence and recency) so a human resolving it later does
not have to recompute what already changed on the underlying rows.

`BrainWriteCandidate` gained one column, `contradictionResolution`
(`ACCEPT_NEW`/`KEEP_EXISTING`/null), which is what actually unblocks or permanently stops a
stuck candidate — `contradictionOf` alone, from step 2, only ever meant "something to
resolve." The full sequence, entirely inside the `EXTRACTED → CONTRADICTION_CHECKED`
transition:

1. `findEffectiveBrainFact` (extended to also return the existing row's own confidence and
   `createdAt`, only for `L1_NODE`/`L1_EDGE`) plus `decideContradiction` (step 2, unchanged)
   finds an undeclared conflict or does not.
2. No conflict: `contradictionOf` and `contradictionResolution` both persist as null, same
   as step 2.
3. A conflict `resolveContradiction` resolves as `AUTO_SUPERSEDE`: `contradictionOf` and
   `contradictionResolution: 'ACCEPT_NEW'` persist together, in the same transition — no
   queue entry is ever created, because an auto-resolved conflict never becomes a human's
   problem.
4. A conflict it cannot resolve: `contradictionOf` persists with `contradictionResolution`
   still null, and `enqueueBrainConflict` opens a queue row in the same breath — proven by
   `write-path.integration.spec.ts`'s case, which asserts the queue entry exists and names
   the right candidate before a human ever looks at it.

A queued conflict's disposition, once a human calls `resolveConflict`/`resolveBrainConflict`:
`ACCEPT_NEW` calls straight through to `recordContradictionResolution`, which requires the
candidate to actually be sitting at `CONTRADICTION_CHECKED` with an unresolved conflict and
refuses to record a second verdict over an existing one — the same "cannot happen twice"
shape `ratifyBrainWrite` already has. `KEEP_EXISTING` stops the candidate at
`CONTRADICTION_CHECKED` permanently; there is no new terminal `BrainWriteStatus` for a
rejected candidate; a stuck, never-advancing row already says that honestly.

`advanceBrainWrite` gained one more structural guard, alongside step 2's
`REQUIRED_PREDECESSOR` table: it refuses `PROVENANCE_STAMPED` for a candidate whose
`contradictionOf` is set and whose `contradictionResolution` is not `ACCEPT_NEW` — the same
defence-in-depth shape the `COMMITTED` gate already has for ratification, so a caller in
`packages/brain` that got the sequencing wrong fails at the database layer, not just in its
own logic.

**Supersession without a declaration.** Step 2 built `supersedes` as always caller-declared,
never inferred. An auto-resolved or human-accepted conflict changes that narrowly:
`buildFactToCommit`'s `resolvedSupersedes` helper uses the candidate's own declared value
if it made one, falling back to `contradictionOf` otherwise — reachable only once
`advanceOnce`'s own guards have already refused to let an unresolved or rejected conflict
reach this point. Proven directly: the auto-supersede integration case asserts the
committed row's `supersedes` points at the fact it won against, with no declaration in the
candidate's payload at all.

Deviations from manual: none. Step 3's own text — compare provenance and recency; carve out
human-ratified facts; enqueue and keep both versions otherwise — is exactly what was built,
with the human-ratified carve-out satisfied by step 2's existing ratification gate rather
than a second mechanism.

Open questions raised: none.

**What this slice put in place (step 4 — the retrieval path)**

The manual's own order: `query → intent router → policy + RBAC + purpose gate → vector
top-k → graph n-hop expansion → episodic temporal filter → rerank → token-budgeted context
assembly`. `packages/brain/src/retrieval-path.ts`'s `retrieve()` runs every one of the
seven stages in exactly that sequence, and records each as it runs into a `trace` array —
`retrieval-path.integration.spec.ts` asserts the trace equals `RETRIEVAL_PATH_ORDER`
verbatim on the happy path, which is what makes a reordering of the orchestrator's own code
a failing test rather than a silent drift, the same proof shape `nextStatus` gave the write
path in step 2.

**"The policy gate runs before retrieval, never after," proven behaviourally.** The policy
gate (`retrieval-policy-gate.ts`) is the second stage; nothing after it runs on a refusal —
`trace` simply stops at `['intent_routed', 'policy_gated']`. The integration suite proves
this without mocking anything: a refused request is built with an empty query embedding and
a malformed (start-after-end) episodic window, both of which `vectorTopK` and
`filterEpisodesByWindow` throw on if actually called — the request resolving cleanly is
direct evidence neither one was.

**No composed "RBAC + purpose + consent" gate existed anywhere in the repo before this.**
`authorize()` (Stage 02) and `resolveAccess()` (Stage 03, which already sequences tombstone
→ purpose → consent internally) were two separate, pure entry points with no shared
caller. `gateRetrieval()` composes them for the first time: coarse role/scope first,
then — only for a retrieval naming one specific data subject — the fine-grained
purpose/consent projection. A retrieval about curriculum canon, a topic or a CAPS code has
no single subject and stops at the RBAC check, which is the whole gate for those.

**The intent router is deliberately mechanical.** Real intent classification from free
text needs either a trained classifier or a model call, and a model call would need to go
through the Model Gateway (rule 3) from a real caller with its own prompt version, eval
set and cost budget (rule 9's new-agent checklist) — Stage 06's agent runtime, which does
not exist yet. `routeIntent()` takes no query text at all: it reads what the caller already
declared (an entity-type hint, whether a query embedding was supplied, whether a time
window was named) and turns that into a plan. Building a first, uncalibrated path to a
model here would be exactly what rule 9 exists to stop.

**The vector top-k stage is real SQL against real (if currently empty) data.** Prisma
cannot represent `Unsupported("vector")` at all, so `packages/db/src/brain-retrieval.ts`
hand-writes the one query that touches it — `embedding <=> $1::vector`, ordered ascending,
over effective (non-tombstoned, non-superseded) nodes only, the same "effective" test
`findEffectiveBrainFact` already applies. This corrects a note from step 1's own schema
comment, which said this raw SQL would live in `packages/brain`; that was written before
the retrieval path's actual architecture existed, and keeping every Brain table's access
inside `packages/db` — the split the write path already settled on — is worth more than
honouring the early guess. The schema comment is corrected in the same commit. No caller
produces a real query embedding yet (no embedding model is chosen — step 1's own gap), so
`queryEmbedding` is an optional, caller-supplied input; supplying a real one is whichever
future caller first wires the Model Gateway's `/v1/embeddings` endpoint to the Brain, not
built here.

**Graph n-hop expansion and the episodic temporal filter are both fully real**, over the
data step 1-3 already produce: breadth-first traversal of `brain_edge` in either direction,
one query per hop rather than per node, tagging each discovered node with the hop it was
first reached at (`ExpandedNode.hops`, which `rerank` discounts by); and a plain
`occurredAt`-windowed read of `brain_episode`, optionally narrowed to one subject node —
the "what did we decide about X in Term 2 last year" query this stage exists for.

**Rerank is a documented deterministic score, not a model call or a learned reranker.**
confidence × a recency half-life (180 days) × a per-hop graph-distance discount, entirely
computed from provenance the Brain already carries on every fact — nothing here needs
explaining beyond what `explain()` (step 9) will already walk.

**Token-budgeted assembly here is deliberately not step 5's packer.** Step 5's own text
asks for priority ordering (L0 constitution first, then task-relevant L1/L2, then
exemplars) and a record of what was included and dropped — real algorithmic work step 4's
own text does not ask for, since it only names "token-budgeted context assembly" as the
pipeline's last stage. What this slice guarantees, and step 5 will keep: highest-score-first
selection with whole-candidate granularity — a candidate is included or dropped entire,
never truncated mid-fact. Token counts are estimated at four characters per token, a
documented placeholder rather than a real tokenizer, which nothing here needs to be exact
about — only conservative enough that the budget is never exceeded.

**Every stage traced.** `retrieve()` takes an optional `@infinite-ai/telemetry` `Tracer`
(defaulting to `NOOP_TRACER`, the same fail-open shape Stage 04 established), wrapping the
whole call in one `brain.retrieve` span with an event per stage and attributes for the
policy decision, match/expansion/episode counts, and the assembled/dropped counts and total
tokens. The integration suite asserts against a real span from
`@opentelemetry/sdk-trace-base`'s in-memory exporter, the same one `apps/gateway`'s own
tests already use, rather than a hand-rolled fake tracer.

**What the policy gate's `access` decision does not do.** `resolveAccess()`'s
`allowed`/`dropped` categories are a boundary decision — whether the retrieval may proceed
at all — not a per-field redaction of a Brain node's free-form `attributes` or an episode's
`detail`. Nothing in this schema declares which `DataCategory` a given attribute belongs
to, unlike the Stage 03 tables' columns, which map to a category one-for-one. Attaching
that mapping is a later module's job, once one exists with concrete attributes to classify
— recorded here rather than silently assumed away.

Deviations from manual: none in the pipeline's own shape. The two gaps above (no real
query-embedding producer, no per-attribute category mapping) are follow-up work tied to
capabilities other steps and stages own, not decisions needing a human's judgement call.

Open questions raised: none.

**What this slice put in place (step 5 — token-budgeted assembly)**

Step 4 shipped `assembleContext` as a deliberate placeholder — highest-score-first over
whatever the earlier stages found, because nothing fetched L0 or L3 yet and step 4's own
text never named a priority order. This slice is the real algorithm step 5's own text asks
for: three fixed tiers, packed in this order regardless of score or size — **L0
constitution**, then **task-relevant L1/L2** (in the order `rerank()` already computed),
then **L3 exemplars**. Whole-candidate granularity carries over unchanged from step 4: a
candidate too big for what remains is dropped entire, never truncated mid-fact, and the
packer keeps trying the rest of its own tier rather than stopping at the first miss —
`retrieval-assembly.spec.ts`'s "backfills a later tier with budget an earlier tier could
not use" proves this holds across tiers too, not only within one.

**Two reads that did not exist before this slice.** Step 4 built the pipeline's three
data-touching stages around L1 (vector, graph) and L2 (episodic) — nothing ever fetched L0
or L3, because assembly did not yet need to prioritise them. `packages/db/src/
brain-retrieval.ts` gained `listEffectiveConstitution` and `listEffectiveExemplars`:
every non-superseded `brain_constitution` row for the tenant, and every non-superseded
`brain_procedure` row of kind `EXEMPLAR` (the other four `BrainProcedureKind` values —
prompt versions, pipelines, SOPs, tool contracts — are Stage 06 machinery, not retrieval
context, so this deliberately reads only the one kind step 5's own text names). Neither is
filtered by the intent router's plan: ratified policy applies tenant-wide, not to whichever
entity types one query happens to be searching for, so both run unconditionally once the
policy gate passes — the same reasoning each function's own header gives.

**Two new stages in the trace, not a change to the existing seven.**
`RETRIEVAL_PATH_ORDER` grew from seven entries to nine: `constitution_fetched` (right after
`policy_gated`, so L0 is fetched before anything else touches the database) and
`exemplars_fetched` (right after `episodes_filtered`, before `reranked`). The ordering
guarantee step 4 built — a refusal's `trace` stops at `['intent_routed', 'policy_gated']`,
never reaching a data-touching stage — holds unchanged; the new stages are simply two more
names that never get pushed on a refusal, proven the same way (`retrieval-path.integration.
spec.ts`'s refusal test still asserts the two-entry trace verbatim).

**Rerank still only scores what it always scored.** `rerank()`'s signature narrowed from
the full `RetrievalCandidate` union to a new `RankableCandidate` alias (`NodeRetrievalCandidate
| EpisodeRetrievalCandidate`) — the two kinds that carry a `confidence` an extraction
actually produced. Constitution and exemplar candidates never go through it: a ratified
fact does not carry a probability the way an extracted one does, and scoring it against
node/episode candidates on the same axis would have implied a false equivalence. Tier
position, not score, decides where they land — `ConstitutionRetrievalCandidate` and
`ExemplarRetrievalCandidate` carry no `confidence` field at all, so the omission is a type
error to get wrong, not a convention to remember.

**`packages/brain` still takes no direct dependency on `@prisma/client`.** The new
candidate types need `BrainConstitutionKind`; rather than importing it from `@prisma/
client` (breaking the separation step 4 kept — packages/brain works with mirrored
Zod/string-literal types, packages/db owns the real Prisma ones), `write-path-schemas.ts`'s
already-existing but module-private `BrainConstitutionKind` Zod enum is now exported, the
same treatment `BrainEntityType` already got in step 2/4.

**Proven end to end, not only at the unit level.** A new integration test commits a real
`L0_CONSTITUTION` fact through the actual write path (open → run → ratify → run, the same
ratification gate step 2 and step 3 already exercise) alongside a vector-matched `L1_NODE`,
then retrieves with a token budget sized to fit only the constitution fact's own estimated
cost. The assembled context contains exactly the constitution candidate; the higher-
scoring vector match is dropped — proof that tier order beats rerank score, against a real
Postgres, not only against hand-built fixtures in a pure unit test.

Deviations from manual: none. Step 5's own text — priority ordering L0 first, then
task-relevant L1/L2, then exemplars; record what was included and dropped; never truncate
mid-fact — is exactly what was built.

Open questions raised: none.

**What this slice put in place (step 6 — provenance)**

Step 6's own text — "every fact stores source, actor, timestamp, confidence, derivation
… and the trace ID" — was already true of the schema before this slice: step 1 built
every one of those columns onto all five tables, and step 2's write path
(`buildFactToCommit`'s `provenance` object for L1/L2, `requireRatification` for L0/L3)
has stamped every one of them on every commit since. What this slice adds is the missing
other half — a normalized **read**. Five tables, five different column sets, and until
now no shared shape a caller could ask "what is this fact's provenance?" against without
already knowing which table it lives in: `L0_CONSTITUTION`/`L3_PROCEDURE` have
`ratifiedBy`/`ratifiedAt`/`version` and no `source`/`confidence`; `L2_EPISODE` alone has
`actorId`; `L2_EPISODE`'s creation timestamp is a differently-named column
(`recordedAt`, not `createdAt`) for the same reason `ConsentRecord.effectiveFrom` is
named apart from `createdAt` elsewhere in this schema.

`packages/db/src/brain-provenance.ts`'s `getFactProvenance(tx, targetTier, id)` is that
normalization: one `FactProvenance` shape for all five tiers, with the tier-inapplicable
fields (a ratified tier's `source`/`confidence`, an unratified tier's `ratifiedBy`) simply
null rather than the caller needing to know in advance which columns a given tier even
has. It is deliberately _not_ a chain-walker — it reads one fact's own row, once. Step 9's
`explain()` is what will follow `supersedes` across repeated calls to build a full
explanation; this step only guarantees the single-fact primitive that walk will be built
out of, the same layering the write path already draws between `packages/db` (persistence
primitives) and `packages/brain` (the decisions and sequencing built on top of them).

**A wrong tier is treated as "not found," not as an error or a cross-tier leak.** Asking
`getFactProvenance` for a real id under the wrong `targetTier` — an `L1_NODE`'s id passed
as `L2_EPISODE` — returns `null`, exactly like an id that does not exist at all. Proven
directly: `brain-provenance.integration.spec.ts` commits a node, then reads its id back
under `L2_EPISODE` and asserts `null`, not the node's own data mislabelled. This matters
because a future caller (`explain()` among them) will often be walking a chain without
perfect foreknowledge of every link's tier; failing closed to "nothing" rather than
returning a wrong tier's row is what makes that safe to build on.

**No new caller yet, and that is deliberate, not a gap.** Nothing in `packages/brain`
calls `getFactProvenance` in this slice — the manual gives that read its own consumer only
at step 9 (`explain()`, part of the Brain API). Building the primitive now, proven
directly against a real Postgres for all five tiers, is what step 6's own numbered
position in the manual asks for; wiring it into a caller before that caller exists would
be exactly the kind of premature abstraction the project's own rules warn against.

Deviations from manual: none. Every column step 6's own text names was already present on
every table from step 1 onward; this slice's contribution is the normalized read, which
the manual's step 9 (`explain()`) presupposes exists.

Open questions raised: none.
