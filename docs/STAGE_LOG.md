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

Started: 2026-08-04 Completed: 2026-08-05
Exit gate: **PASS** — all ten steps are built and proven. Retrieval order is enforced by
test (`result.trace` is generated by the pipeline's own execution order, so a reordered
stage produces a different trace, not merely a differently-labelled one). No code path
performs a destructive update on a Brain table (the `app_forbid_mutation()` trigger, proven
against every append-only table including all five Brain fact tables). `explain()` returns
a complete chain for every one of the five fact types. The restore drill is documented in
`docs/RUNBOOKS/brain-restore.md`, written in this stage per that runbook's own assignment
in `docs/RUNBOOKS/README.md` — its _rehearsal_, and the nightly-snapshot/point-in-time-
recovery mechanism it drills against, remain Stage 15's, exactly as step 7's own write-up
below already reasoned for the underlying infrastructure. Two further sub-items are
deliberately deferred and stated plainly in each step's own write-up: step 7's nightly
snapshots (Stage 15's job), and step 8's automatic consent-withdrawal sweep and episode
tombstoning (both stated follow-ups, not silently assumed away).

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

**What this slice put in place (step 7 — never-forget guarantees)**

Step 7 names four things: an append-only event log for all Brain writes, nightly
snapshots with point-in-time restore, an immutable read/write audit trail, and
`brain_conflict_queue`. The fourth was already built in step 3. This slice builds the
first and third together, as one mechanism, and is explicit below about why the second is
not built here.

**The append-only event log for all Brain writes, and the immutable audit trail, are the
same gap.** `brain_write_candidate` is deliberately _mutable_ — each transition
overwrites `status` in place, so a failed run resumes rather than restarts, the design
step 2 chose and the schema's own comment documents. That means the row itself, once a
later transition has moved past an earlier one, no longer shows what it went through to
get there — there was no durable record of the journey, only of its current position.
`packages/db/src/audit.ts`'s `appendAuditEvent` closes this: it reads the tenant's current
last hash, chains a new event onto it with `@infinite-ai/telemetry`'s `chainEvent` (Stage
02's pure hash-chain logic, built but never called from `packages/db` until now), and
inserts — inside the same transaction as the write it is recording, so the event and the
fact commit or roll back together. `packages/brain/src/write-path.ts` now calls it from
every `advanceBrainWrite` transition (via a new `auditedAdvance` wrapper), from `ratify()`,
and from `resolveConflict()` — every Brain write and every human governance decision on
one, produces an audit event.

**This finishes what Stage 03's own `erasure.ts` had already flagged as unfinished.**
`writeErasureEvent`'s own comment says so directly: "the tamper-evident chain that links
events to each other is Stage 02's, and this call site links into it when that lands."
`appendAuditEvent` is general — any future caller can use it, not only Brain writes — but
this slice does not retrofit `erasure.ts` onto it: that file's own gap is already
documented at its own call site, or touching Stage 03 code is out of this step's scope,
and the fix belongs with whoever next touches that file, not as a drive-by change here.

**A Postgres advisory lock prevents the one race a hash chain cannot recover from.**
Two transactions racing to append an event for the same tenant could both read the same
"last" hash and each chain onto it, forking the ledger silently — the kind of bug nobody
notices until an audit tries to walk the chain and finds two events claiming the same
predecessor. `appendAuditEvent` takes a transaction-scoped `pg_advisory_xact_lock` keyed
on the tenant id before reading the last hash, serializing concurrent appends for that
tenant; the lock releases automatically at commit or rollback. Proven directly:
`audit.integration.spec.ts`'s "chains a second event onto the first" test appends twice in
the same transaction and asserts the pair verifies intact with `verifyChain`, and
`write-path.integration.spec.ts`'s new "audit trail" tests prove a real six-transition
write path produces a six-event chain that verifies intact end to end, not merely six
individually well-formed rows.

**No PII in the ledger, the same boundary every other audit write in this schema already
holds.** `auditedAdvance`'s `diff` never carries a candidate's actual payload — only
structural fields (`toStatus`, `contradictionOf`, `committedRowId`, and so on). An audit
trail that recorded what a fact actually said would be a second copy of the fact with a
different retention story, the same reasoning `erasure.ts`'s own header already gives for
its diff.

**Nightly snapshots with continuous point-in-time recovery are deliberately not built in
this slice.** This is a genuine cross-stage boundary, not an oversight: Stage 15
("Observability, SLOs, disaster recovery") step 6 explicitly owns "Postgres point-in-time
recovery... Brain snapshots" — the WAL-archiving mechanism that recovers to an arbitrary
past timestamp against a real deployed environment. This project has no infrastructure
pipeline yet, only a local Docker Compose dev database and Testcontainers-backed test
databases, both ephemeral; building that mechanism now would mean inventing infrastructure
decisions Stage 15 owns. Rule 2's own spirit — never fake a control to make something look
done — argues the same way a hollow "restore" test would: it would not prove anything true
about production recoverability.

**Correction to this paragraph, made in step 10: the runbook _document_ is this stage's
job, not Stage 15's.** This paragraph originally deferred `docs/RUNBOOKS/brain-restore.md`
itself to Stage 15 alongside the PITR mechanism, reading Stage 15 step 7's "write and then
rehearse the runbooks" as assigning the writing to Stage 15 too. `docs/RUNBOOKS/README.md`
— committed in Stage 00, before any of Stage 05's own work — already answers this more
specifically than the manual's stage-level phrasing does: its own table assigns
`brain-restore.md` "05 (written), 15 (drilled)," the same split it gives
`provider-outage.md` (04 written, 15 drilled) and `tenant-data-erasure.md` (03 written, 17
drilled) — a runbook is drafted in the stage that built the mechanism it describes, while
rehearsing it against real infrastructure waits for the stage that has that
infrastructure. Step 10 writes `docs/RUNBOOKS/brain-restore.md` now, honestly scoped to
what is real today (a snapshot/restore round trip, not continuous PITR) and explicit about
what Stage 15 still owns, rather than leaving it unwritten for six stages on a misreading
of one paragraph's wording.

Deviations from manual: the nightly-snapshot/PITR/restore-drill portion of step 7 is
deferred to Stage 15, for the reasons above — not a decision needing a human's judgement
call (it follows directly from how the manual itself splits the two stages' ownership),
so recorded here rather than in `docs/OPEN_QUESTIONS.md`.

**Defect found in CI, fixed in the same PR: `at` cannot disambiguate insertion order.**
`appendAuditEvent`'s first version found "the last event for this tenant" by ordering
`at DESC, id DESC`, on the assumption that ties on `at` would be rare and that `id` (a
random UUID) was an acceptable fallback when they happened. The very first real caller
broke both assumptions: `write-path.ts`'s `run()` reuses one `now` across an entire
candidate's journey through every transition, so a single L1_NODE write produced six
audit events sharing the exact same `at`. Under that tie, `id DESC` has no relationship to
actual insertion order, so the "last event" query returned the wrong row for one
transition, chaining onto an earlier link instead of its true predecessor —
`write-path.integration.spec.ts`'s new audit-trail test caught this immediately
(`verifyChain` reporting `broken_link` at position 2, not `intact`). The fix is a genuine
schema addition, not a query tweak: `audit_event` gains `sequence`, a plain
autoincrementing bigint independent of any caller-supplied timestamp
(migration `20260805120000_stage05_audit_event_sequence`), and `appendAuditEvent` now
orders by it instead. Ordering by an autoincrement column is what "last row inserted"
actually means in Postgres; ordering by a caller-supplied timestamp never guaranteed that,
even before a real caller's usage pattern exposed it.

**A second, deeper defect surfaced once the first was fixed, in the same PR: `jsonb`
does not preserve key order.** With `sequence` fixing the chain's link order, the same
test then failed differently — `hash_mismatch` on the _last_ event only, not
`broken_link`. Postgres's `jsonb` column type (`audit_event.diff`) reorders an object's
keys internally (by length, then lexicographically) rather than preserving the order they
were given; the events whose `diff` keys happened to already be in that order round-
tripped correctly, and the one whose keys were not (`retentionCategory` before the
shorter `retentionRuleId`) did not. `packages/telemetry/src/audit.ts`'s `canonicalise`
hashed `diff` with plain `JSON.stringify`, which its own header comment already warned
key-reordering could defeat — one level higher than where the warning was actually
applied. The fix: a `canonicalStringify` that sorts object keys recursively before
stringifying, used for `diff` specifically, so the hash no longer depends on jsonb's
internal reordering scheme at all. Three new unit tests in `packages/telemetry/test/
audit.spec.ts` prove it directly, with no database involved: two diffs with the same
keys in a different order hash identically (top-level and nested), and genuinely
different diff content still hashes differently.

Both defects were caught by the same integration test, in this same PR, before merge —
exactly what a real end-to-end proof against Postgres is for. Neither would have been
visible from the pure `packages/telemetry` unit suite alone, since nothing in it had ever
round-tripped a chained event through an actual `jsonb` column before this stage.

Open questions raised: none.

**What this slice put in place (step 8 — forgetting by design)**

Step 8 names four things: TTL on personal data per retention class, tombstone on consent
withdrawal with reindex, working-memory eviction per run, and "policy and curriculum never
expire." The third was already built — step 1's `working-memory.ts` shipped `evict()` with
a comment naming this exact step, and `remember`/`recall`/`recallAll` already expire
entries by TTL. The fourth needed nothing new to build, only confirming: `L0_CONSTITUTION`
and `L3_PROCEDURE` payloads have no `dataCategory` field in their Zod schemas at all, so
there is nothing for the retention resolution below to ever act on for those two tiers —
proven directly by a test that passes a `dataCategory` into an `L0_CONSTITUTION` candidate
and asserts it never survives extraction. This slice builds the first and second.

**Closing the gap `write-path.ts` itself already named.** Step 2's `RETENTION_SCHEDULED`
transition always set `retentionCategory`/`retentionRuleId` to `null`, with its own
comment pointing here: "assigning a fact a personal-information category and matching it
to a ratified `RetentionRule` is step 8's job." `dataCategory` is now a caller-declared
field on `L1NodePayload`/`L1EdgePayload`/`L2EpisodePayload` — declared, never inferred,
for the same reason `retrieval-path.ts`'s own header already gives for not classifying a
node's free-form `attributes` automatically: nothing in this schema knows what a node's
content actually contains, and guessing from `entityType` alone risks silently
mis-classifying `SPECIAL_PERSONAL` data as something less sensitive. `write-path.ts`'s
`resolveRetention` reads the declared category from the committed candidate's typed
payload and looks it up against a new `packages/db` read, `getRetentionRule` — a rule
found resolves `retentionRuleId`; none found resolves `retentionCategory` alone, the same
"unscheduled, not silently retained forever and not silently destroyed either" honesty
`packages/contracts`'s own `unscheduledCategories` already names for the main data plane.

**The tombstone path is deliberately its own mechanism, not a detour through the write
path.** Rule 11 names it directly: "deletion happens only through the retention/tombstone
path." A tombstone is not a new fact an agent is proposing — it is the retention job (or a
consent withdrawal) acting on a fact that already exists — so routing it back through
`openWrite`'s candidate state machine would mean contradiction-checking a fact against
itself for no reason a caller could explain. `packages/db/src/brain-forgetting.ts`'s
`tombstoneBrainFact` inserts directly instead: a new row copying the original's content,
with its own `tombstonedAt` set and `supersedes` pointing at the original. The original is
never touched — the append-only trigger would refuse an UPDATE if this tried one — and
`vectorTopK`'s own `WHERE tombstoned_at IS NULL AND NOT EXISTS (... supersedes ...)` then
excludes _both_ rows from retrieval structurally: the original because something
supersedes it now, the new row because it is tombstoned itself. That is the entire
"reindex" step 8 asks for — there is no separate search index for Brain nodes, only this
one table and the query every retrieval already runs against it. Proven directly:
`brain-forgetting.integration.spec.ts` inserts an embedding, confirms `vectorTopK` finds
it, tombstones it, and confirms `vectorTopK` no longer does.

**Only `L1_NODE` and `L1_EDGE` are tombstonable.** They are the two tiers with a
`tombstonedAt` column at all — `L2_EPISODE` has none. Extending the episode table so a
correction-by-erasure is possible there too is a real, stated follow-up, not invented in
this slice: episodes are "what happened," and step 8's own text does not name episode
erasure the way it names node/edge tombstoning. `L0_CONSTITUTION`/`L3_PROCEDURE` are never
tombstonable at all, matching "policy and curriculum never expire" exactly.

**The evaluation is pure; the sweep is not — same split the write path draws.**
`packages/brain/src/forgetting.ts`'s `decideBrainRetention` reuses `@infinite-ai/
contracts`'s `evaluateRetention` (Stage 03) to decide one verdict per fact, with no
database involved — fully unit-tested against every verdict branch (expired, within
period, no rule, anchor not reached, anchor mismatch, a mixed batch). `sweepBrainRetention`
is the thin orchestrator on top: it acts on every `tombstone` verdict by calling
`tombstoneBrainFact`. Proven end to end against a real Postgres: a ratified rule, one
expired fact and one current one, the expired fact tombstoned and the current one left
alone.

**What is not built, stated plainly, matching Stage 03's own precedent exactly.** Stage
03's write-up already said it once, for its own tables: "the evaluation function is
written and tested; the worker that runs it has nothing to run until a school ratifies a
schedule" (OQ-007). The same is true here, for the same reason — there is still no
ratified schedule in this environment, and this project has no infrastructure pipeline to
schedule a job on regardless (only local Docker Compose and ephemeral Testcontainers
databases). `decideBrainRetention`/`sweepBrainRetention` are not wired to a scheduler; that
is Stage 15's concern, not this one, per rule 1. Nor is there an automatic
consent-withdrawal sweep — `tombstoneBrainFact` accepts `reason: 'consent_withdrawn'` and
works identically either way, but cross-referencing `@infinite-ai/policy`'s
`evaluateConsent` against which Brain facts belong to which subject token is not built,
the exact same shape of gap Stage 03 left for its own tables ("the pieces exist... and the
job that joins them is not written"). Neither omission is a judgement call for a human to
make — both follow directly from decisions already made and documented elsewhere in this
project — so recorded here rather than in `docs/OPEN_QUESTIONS.md`.

Deviations from manual: none in what was built. The two stated gaps above are follow-up
work with a precedent already set by Stage 03, not decisions needing a human's judgement
call.

Open questions raised: none.

**What this slice put in place (step 9 — the Brain API)**

Six typed functions in one new file, `packages/brain/src/api.ts`: `remember`, `recall`,
`ratify`, `supersede`, `forget`, `explain` — "typed functions, not free-form SQL," the
manual's own phrase. Nothing here is new logic; every one of the six composes primitives
steps 1-8 already built and proved in isolation. `remember` is `openWrite` + `run` (step
2); `recall` is `retrieve` (steps 4-5) under the manual's own name; `forget` wraps
`@infinite-ai/db`'s `tombstoneBrainFact` (step 8). This is deliberately the one surface a
caller outside `packages/brain` is meant to use — `packages/brain/src/index.ts`'s export
list now puts these six names ahead of the lower-level primitives they are built from,
which remain exported for a resuming worker's own use (`advanceOnce`, `listOpenWrites`,
the record-only `ratify` in `write-path.ts`, importable directly from there).

**`ratify` here does more than `write-path.ts`'s own `ratify`.** The lower-level function
only records who ratified a candidate and when — deliberately, so a worker can record a
human's decision now and commit it later via a separate `advanceOnce`/`run` call, the same
resumability the rest of the write path is built around. The Brain API's `ratify`
composes that call with `run()`: once a human has ratified a candidate there is nothing
left for it to wait on, so a caller of the API surface gets the finished, committed
candidate back in one call rather than having to remember a second one. Both names could
not be exported from the same module without a collision, so `packages/brain/src/
index.ts` now re-exports the API's `ratify`, and a caller that genuinely wants the
lower-level, record-only primitive imports `write-path.js` directly — exactly what
`write-path.integration.spec.ts` and `retrieval-path.integration.spec.ts` already did
before this step, and still do, unaffected.

**`supersede` is `remember` plus an assertion, not a second write path.** Both submit a
candidate through the identical `openWrite` + `run` sequence — natural-key contradiction
detection for `L1_NODE`/`L1_EDGE`, automatic version-based supersession for
`L0_CONSTITUTION`/`L3_PROCEDURE`, and a caller-declared `supersedes` for `L2_EPISODE`, none
of it new. The difference is only what happens once `run()` settles. `remember` is
neutral: the pipeline decides whether anything was superseded, and a caller that only
wanted to add a new fact never notices either way. `supersede` is a caller's explicit
claim that this candidate replaces something specific, and it is a caller bug — surfaced
as a thrown `BrainApiError`, not swallowed — if that turns out false, in either of the two
ways it can: a `RETENTION_SCHEDULED` result whose committed row's own `supersedes` (read
back via `getFactProvenance`, the same step 6 primitive `explain` uses) is still null means
nothing effective matched what the candidate declared; an unresolved or lost conflict —
`run()` itself throwing `BrainWritePathError` when a human must adjudicate it, or when one
already resolved it against the candidate — is caught and re-thrown as the same
`BrainApiError`, so a caller of this surface only ever sees one error type regardless of
which of the two ways supersession failed. A candidate still `AWAITING_RATIFICATION` is
returned as-is rather than asserted against — whether a ratified tier's candidate
supersedes anything is only knowable once a human ratifies it, which is `ratify`'s job, not
this one's.

**Defect found in CI, fixed in the same PR: `run()` throws on an unresolved conflict, it
never returns one to inspect.** The first version of `supersede`'s assertion switched on
the _returned_ candidate's status, including a `CONTRADICTION_CHECKED` case for "the
conflict was left unresolved." That branch was dead code: `write-path.ts`'s own
`advanceOnce` throws `BrainWritePathError` synchronously the moment it finds an
unresolved or lost conflict at that status (see `write-path.integration.spec.ts`'s own
"refuses to commit... over an undeclared conflict" case, proven the same way well before
this step), so `run()` never returns a candidate sitting at `CONTRADICTION_CHECKED` for a
caller to inspect — it either advances further or throws first. The failing test —
`api.integration.spec.ts`'s "throws when the conflict was left unresolved rather than
superseded" — caught this immediately: the raw `BrainWritePathError` surfaced instead of
the `BrainApiError` the test (correctly) expected. The fix is `runForSupersession`, a
wrapper around `run()` inside `supersede()` that catches `BrainWritePathError` specifically
and re-throws it as `BrainApiError`, and a simplified `assertSuperseded` that only ever
receives what `run()` can actually return — `RETENTION_SCHEDULED` or
`AWAITING_RATIFICATION` — rather than a full, mostly-unreachable `BrainWriteStatus` switch.

**`explain` walks `supersedes` backward, one step at a time, to the fact with none.** Step
6's own header, written when `getFactProvenance` was built, already named this as the
future caller: "the primitive step 9's `explain()` will walk `supersedes` with, not a
chain-walker itself." `explain` is exactly that walk — the given fact, then whatever it
superseded, then whatever _that_ superseded, in newest-first order, normalized across all
five tiers by the same `FactProvenance` shape `getFactProvenance` already returns
(`ratifiedBy`/`ratifiedAt`/`version` for `L0`/`L3`, `source`/`confidence`/`derivationRunId`
for everything else). Proven directly against a real Postgres: a two-hop `L1_NODE`
correction via `supersede`, and a two-version `L0_CONSTITUTION` policy via `ratify`, both
returning their full chain in order, ending at a row whose own `supersedes` is null. A
cycle guard (a `Set` of visited ids) throws rather than looping forever if a chain is ever
corrupted — append-only writes should make that structurally impossible, the same
"defence in depth only" reasoning `write-path.ts`'s own `requireRatification` already gives
for an equivalent should-be-unreachable guard, so it is not itself given a dedicated test.

Deviations from manual: none. Step 9 asks for exactly these six functions with exactly
this shape of guarantee (`explain()` "returns the provenance chain for any retrieved
fact"), and that is what this slice built.

Open questions raised: none.

**What this slice put in place (step 10 — the stage's own test suite)**

Step 10 names five tests. Two were already proven, incrementally, by earlier steps:

- **The supersession test** ("no destructive update anywhere; old versions remain
  readable") — proven repeatedly across `write-path.integration.spec.ts` (L0 versioning),
  `brain-forgetting.integration.spec.ts` (tombstoning, in `packages/db`), and
  `api.integration.spec.ts` (`supersede()`), and structurally by
  `rls.integration.spec.ts`'s `describe.each(APPEND_ONLY_TABLES)` block, which already
  covers all five Brain fact tables (step 1's exit gate). Nothing new needed adding.
- **The budget test** ("assembly never exceeds the budget and always includes L0") —
  `retrieval-assembly.spec.ts`'s "never exceeds the stated token budget" (pure unit test)
  and `retrieval-path.integration.spec.ts`'s "prioritizes L0 constitution ahead of an L1
  match, even under a tight budget" (step 5) already prove both halves of this directly.

Three needed new tests, described below: the temporal test, the policy-gate test, and the
restore test. This slice also fills in `explain()`'s remaining gap (three of five tiers had
no dedicated chain test yet) and, correcting an oversight from step 7, writes
`docs/RUNBOOKS/brain-restore.md` (see the correction recorded above, alongside step 7's own
write-up).

**The temporal test composes existing primitives; nothing new was built for it.**
"What did we decide about X in Term 2 last year" needs an as-of query — the version of a
fact that was effective at a past time, not whatever is effective now. No dedicated
capability existed for this, but nothing new needed building either:
`findEffectiveBrainFact` (step 2) finds the current head, and `explain()` (step 9) already
walks its chain with each version's own `ratifiedAt`. `temporal.integration.spec.ts`'s
`asOf` helper is exactly that composition — the first entry in the chain whose `ratifiedAt`
is at or before the asked-about time — proven against a two-version `L0_CONSTITUTION`
policy: asking about a date inside last year's Term 2 returns the version ratified then,
not the version ratified this year, and asking about right now correctly returns the
current version instead, so the mechanism is proven to distinguish "as of a past time" from
"as of now" rather than merely always returning the oldest version. `test:temporal`
(`packages/brain/package.json`) runs this one file directly, matching the manual's own
verification line.

**The policy-gate test needed one addition: a real episode, not just inputs that would
throw if reached.** Step 4's own retrieval-path suite already proved the gate refuses
_before any data read_ using malformed inputs that would throw if their stage ever ran —
solid proof the ordering is enforced, but not the manual's own worked example directly: "a
teacher cannot retrieve another class's episodes _even when semantically relevant_." The
new test in `retrieval-path.integration.spec.ts` commits a real, valid `L2_EPISODE` inside
the queried window — semantically and temporally exactly what the episodic filter would
return — then runs the identical query as a teacher scoped to a different class. The
result: refused, zero candidates, and a `trace` that stops at `policy_gated` — the episode
is real and would have matched, and the actor is refused anyway, which is the stronger
claim step 10 actually asks for.

**`explain()` now has a dedicated chain test for every one of the five fact types.** Step
9's own tests covered `L1_NODE` (via `supersede()`) and `L0_CONSTITUTION` (via `ratify()`
twice); this slice adds `L1_EDGE` (via `supersede()`, the same natural-key correction
pattern as `L1_NODE`), `L2_EPISODE` (via `supersede()` too — its `supersedes` is always
caller-declared rather than contradiction-detected, but `assertSuperseded`'s check on the
_committed row's own_ `supersedes` field does not care which mechanism set it, so the same
API call proves the same guarantee), and `L3_PROCEDURE` (via `ratify()` twice, the same
version-chain pattern as `L0_CONSTITUTION`). All three in `api.integration.spec.ts`,
alongside the two step 9 already had.

**The restore test proves a real snapshot-and-restore round trip, not continuous
point-in-time recovery.** See the correction above for why continuous, arbitrary-timestamp
recovery is Stage 15's mechanism to build, not this stage's. What _is_ real and provable
today: `@testcontainers/postgresql`'s own `snapshot()`/`restoreSnapshot()` — a genuine
Postgres `CREATE DATABASE ... WITH TEMPLATE` physical copy inside the same engine, not a
mock of one — round-trips a captured Brain state exactly.
`restore.integration.spec.ts` builds a representative state (a two-version, ratified
`L0_CONSTITUTION` chain and a tombstoned `L1_NODE`), takes a snapshot, writes a further
fact _after_ the snapshot, restores, and confirms: the pre-snapshot state — both
`explain()` chains and the tombstone's own fields — comes back byte for byte, and the
post-snapshot fact is gone. That second half is what makes this a genuine restore proof
rather than a no-op: it demonstrates recovery actually reverts to the captured point,
not merely that data survives untouched.

One implementation note for a Prisma-backed test written against a mechanism that drops
and recreates the whole database: `@infinite-ai/db`'s pooled `PrismaClient` (`client.ts`'s
module-level `singleton`) must be released with `disconnect()` before both `snapshot()`
(Postgres's `CREATE DATABASE ... TEMPLATE` requires zero other connections to the source
database) and `restoreSnapshot()` (which drops the live database outright). `withTenant()`
reconnects lazily against the same `DATABASE_URL` afterwards, now pointed at whichever
database state is current.

**Docker access in this authoring environment.** Unlike every earlier integration suite in
this project, this session had a live Docker daemon available and used it to prove the
unit tier, typecheck and lint directly. Pulling the `pgvector/pgvector:pg16` image the
integration suites need was refused by this session's own egress policy (403 from the
registry's CDN, confirmed after configuring the daemon's proxy correctly) — the documented
"report, do not route around" case for that failure class, not something to work past. The
new integration tests in this slice are therefore proven the same way every integration
test in this project has been until now: written against the exact, verified behaviour of
the libraries and Prisma models involved, and proven for real in CI, which does have that
access.

Deviations from manual: none in what was built, beyond the step 7 correction recorded
above (a mis-scoping of an earlier slice's own reasoning, not a deviation from what step 10
itself asks for).

Open questions raised: none.

## Stage 06 — Agent runtime, Prompt Registry, DAG orchestrator, guardrails, HITL

Started: 2026-08-05 Completed: —
Exit gate: **PARTIAL** — steps 1 (the Agent contract), 2 (the Agent Registry), 3 (the
Prompt Registry), 4 (the DAG orchestrator), 5 (Human-in-the-loop gates) and 6 (the
Guardrail engine) are built and proven. Steps 7-10 are not started.
`scripts/verify-stage.ts`'s `06` entry stays empty until they are.

**What this slice put in place (step 1 — the Agent contract)**

`packages/agents/src/contract.ts`: one Zod schema, `AgentContract`, covering every field
the manual's own step 1 names — `id`, `version`, `module`, `purpose`, `inputSchema`,
`outputSchema`, `promptRef`, `model`, `tools`, `guardrails`, `budget`, `evalSetRef`,
`requiresApproval`, `writesToBrain` — plus `validateAgentContract`, the function that
parses a candidate against it and throws `AgentContractError` naming exactly which field
failed and why. "An agent that omits any field fails to register" (the manual's own text)
is a registry behaviour, step 2's job; this step defines what "valid" means so step 2 has
something real to call.

**`inputSchema`/`outputSchema`/a tool's own `inputSchema` are validated as actual Zod
schema instances, not just checked for presence.** These fields hold code (a `ZodType`),
not JSON-shaped data, which is not the usual shape for a Zod-validated boundary. Rather
than skip validating them or fall back to a bare presence check, the schema uses
`z.instanceof(z.ZodType)` — true for any concrete Zod schema regardless of its own type
(`ZodObject`, `ZodString`, whatever an agent author actually wrote) — so a placeholder
plain object standing in for "the schema I'll write later" fails registration the same way
a missing `budget` does, rather than compiling silently and only failing the first time
something actually tries to `.parse()` it.

**`module` and `guardrails`/`evalSetRef`/`promptRef` are validated as shapes, not against
closed lists — deliberately, and for two different reasons.** `AgentModule` is a pattern
(`MOD-\d{2}` or `LE`), not a closed enum of the five modules built so far: Part 5.2 names
`MOD-06` and beyond as a real, anticipated extension ("a new module must supply its own
agent set..."), the same reasoning `LogicalModel`'s own `domain.action` pattern (Stage 04)
already gives for logical model names it cannot enumerate in advance either. `guardrails`,
`evalSetRef` and `promptRef`, by contrast, reference subsystems this stage has not built
yet (the Guardrail Engine, step 6; the Prompt Registry, step 3) or that a later stage owns
entirely (the eval harness, Stage 07) — so today they are checked only for a valid _shape_
(a non-empty string; an agent id and a semver pair), the same "declare now, cross-check for
real existence once the owner exists" split Stage 05 already used for `retentionRuleId`
and `dataCategory`. `AgentRegistry` (step 2) is a real, stated follow-up for tightening
`promptRef` once step 3 exists; the eval-set check names a genuine cross-stage dependency
(Stage 06 asking a Stage 07 artefact to exist) that cannot close until Stage 07 is reached,
per rule 1.

**`AgentBudget` is a different concept from the gateway's own `BudgetLimits`, not a
duplicate of it.** `apps/gateway/src/budgets/budget.ts`'s `BudgetLimits` (Stage 04) is a
tenant's own configurable daily/monthly aggregate spend ceiling, checked at the gateway
before any provider call. `AgentContract`'s `budget` is a fixed property of the agent's
own definition — a ceiling on what a single run may cost, declared by whoever builds the
agent (CLAUDE.md's own Definition of Done: "adds an agent → ... and a cost budget") — and
is not wired to anything that spends against it yet; that wiring is the orchestrator's
job (step 4) once a run actually exists to charge one against.

Proven by `packages/agents/test/contract.spec.ts`: a fully-declared contract round-trips
through `validateAgentContract`; a contract with a declared tool round-trips too; and eight
failure cases each name a distinct way a contract can be incomplete or malformed (a missing
field entirely, an invalid `module`/`version`/`purpose`, a non-Zod `inputSchema`, a tool
missing its own `inputSchema`, an unrecognised tool `sideEffect`, and an incomplete
`budget`) — each asserted to throw `AgentContractError` specifically, not merely "an
error."

Deviations from manual: none. Step 1 asks for exactly this one file with exactly this
field list, and that is what this slice built.

Open questions raised: none.

**What this slice put in place (step 2 — the Agent Registry)**

`packages/agents/src/registry.ts`: `AgentRegistry`, a typed in-memory registry keyed by an
agent's own `id`, and `bootAgentRegistry`, the startup validation pass — it registers a
list of candidates in order and throws on the first one that fails, for any reason, rather
than returning a partially-populated registry to a caller that might use it anyway. Two of
the manual's own four named boot-failure conditions ("undeclared purpose, or absent
budget") were already structural as of step 1 — `purpose` and `budget` are required fields
on `AgentContract`, so a contract missing either never gets past `validateAgentContract`
at all, and `registry.register()` inherits that check by calling it first. This step adds
the other two: a duplicate `id` (never named by the manual's own list, but implied by "a
typed registry" needing an actual identity rule) refuses outright, since an id is never
reused for a different agent and a version bump is not a second agent coexisting under
the same one.

**"Unknown prompt ref" and "missing eval set" are real checks with no real subsystem to
check against yet — so the registry takes each as an injected function, not a stub.**
Both name a lookup this stage has not built the other end of: the Prompt Registry (step 3)
is what would confirm a `promptRef` names a real, content-hashed prompt version; the eval
harness (Stage 07) is what an `evalSetRef` would actually resolve against. Building either
lookup for real now would mean inventing a later step's or a later stage's own work; hard-
coding "always valid" would silently drop a boot-failure condition the manual explicitly
names. `AgentRegistryOptions.promptExists`/`evalSetExists` split the difference the same
way `apps/gateway/src/routing/router.ts` (Stage 04) already does for a logical model's
routing entry: the _mechanism_ — refuse to register when the check says no — is real and
tested now, with a default that assumes existence until step 3 and Stage 07 exist to
supply the real check. This is not a lowered bar: nothing yet in this codebase can produce
a `promptRef` or `evalSetRef` that doesn't already trace back to a real, hand-written
string, so there is nothing false being assumed valid — only a check with no live data to
run against yet, the same honest gap `contract.ts`'s own header already named for these two
fields.

Proven by `packages/agents/test/registry.spec.ts`: a contract registers and becomes
retrievable by `get`/`has`/`list`; two distinct agents coexist; a duplicate id is refused
and leaves the registry unchanged; a structurally invalid contract propagates
`AgentContractError` and registers nothing; the default (no checker supplied) assumes a
prompt and eval set both exist; an injected checker returning `false` refuses registration
for each of the two respectively, and one test confirms the checker actually receives the
contract's own declared `promptRef`, not a stand-in. `bootAgentRegistry` is proven both to
succeed across several valid candidates and to throw — rather than return anything
usable — the moment one candidate in the batch is invalid.

Deviations from manual: none. The duplicate-id rule is an addition the manual's own step 2
text does not name explicitly, but follows directly from "a typed registry" needing an
actual primary key, the same way `contract.ts`'s own comment on `id` ("never reused for a
different agent") already implied before this step gave it code.

Open questions raised: none.

**What this slice put in place (step 3 — the Prompt Registry)**

`packages/prompts/src/loader.ts`: parses a prompt file's front matter (`agent`, `version`,
`model`, `changelog`, `author`, `ratified_by`) against a Zod schema, validates Part 3.1's
eight mandatory body sections are present in exactly that order and no others, and
sha256-hashes the whole file's raw content. `loadPromptFile` layers on the one check only a
real path can make: that the front matter's own `version` matches the filename and `agent`
matches the directory, so `packages/prompts/src/<agent-id>/<semver>.prompt.md` can never
silently disagree with what the file itself declares. `packages/prompts/src/lock.ts`:
`verifyPromptLock` compares a set of loaded prompts against `prompt-lock.json` (checked in,
starts as `{}` — no real prompt exists yet) and reports every `<agent>@<version>` key
either missing from the lock or hashing differently than what was recorded for it;
`buildPromptLock` is the regeneration function a developer runs after intentionally adding
a prompt or bumping one's version, the same "regenerate, review, commit" shape
`pnpm-lock.yaml` itself already has in this repo.

**No YAML library added — the format doesn't need one.** Front matter here is always this
project's own hand-authored, flat `key: value` shape; nothing in the tree already parses
YAML, and pulling in a dependency to parse a format this constrained would trade a real
cost (a new licence to track, a new supply-chain surface) for nothing this codebase
actually needs. `parseFrontMatterBlock` splits each line on its first colon (so a value
containing its own colon, e.g. a changelog message, still parses correctly) and treats a
bare `null` literal and quoted strings as the two special cases Part 3.1's own example
actually uses.

**The section-order check is exact, not merely "these are present."** `validateSections`
requires the body's top-level (`# `) headings to equal `PROMPT_SECTIONS` — same length,
same order, nothing extra — rather than checking each mandatory section is present
somewhere and ignoring anything else. The manual's own wording ("these sections in this
order... omitting a section fails registry validation") reads as exhaustive, matching this
codebase's general house style of strictness at a validated boundary (the retrieval path's
own fixed stage order, the write path's own fixed transition list) rather than a
best-effort check that would let an unreviewed section quietly ride along.

**The real lockfile check runs against the real, currently-empty tree — proven trivially
today, wired for real from the moment a prompt exists.** `packages/prompts/test/
prompt-lock.spec.ts` scans `packages/prompts/src/` itself (not a fixture) for
`*.prompt.md` files and checks them against the real, checked-in `prompt-lock.json`. Zero
files today means zero violations — an honest reflection of "nothing module-specific goes
in this stage" (no real agent has a prompt yet) — but the mechanism is exactly what will
gate the first real prompt Stage 08 adds, the same "real mechanism, no real data yet"
shape `contract.ts` and `registry.ts` already used for `promptRef`/`evalSetRef` themselves.

Proven by four test files: `loader.spec.ts` (parsing, hashing, and every failure mode —
missing front matter, a malformed line, a missing field, an invalid version or model, a
missing section, sections out of order, an extra section — plus that identical content
hashes identically and changed content does not); `lock.spec.ts` (clean match, a missing
lock entry, a hash mismatch, a mixed batch of both, and `buildPromptLock` round-tripping
back to zero violations); `load-scan.spec.ts` (real temp-directory files proving
`loadPromptFile`'s filename/directory cross-check and `scanPromptFiles`'s recursive,
`.prompt.md`-only, missing-directory-safe scan); and `prompt-lock.spec.ts`, the real check
described above.

Deviations from manual: none. Step 3 names the file location, the front-matter fields, the
content-hashed loader and the lockfile-comparison test; this slice builds exactly that,
plus the filename/directory cross-check the manual's own naming convention implies but does
not spell out as a separate rule.

Open questions raised: none.

**What this slice put in place (step 4 — the DAG orchestrator)**

`packages/orchestrator/src/dag.ts`: a Zod-validated `PipelineDefinition` — an `entryStepId`
plus a map of `PipelineStep`, a discriminated union over the six kinds the manual names
(`agent_call`, `tool_call`, `human_gate`, `branch`, `map`, `compensation`). `validate
PipelineDag` resolves every `next`/branch-target/compensation reference against the step
map and detects cycles on the _forward_ graph only — a `compensatesWith` edge points
backwards to an already-succeeded step by design, so it is excluded from the cycle check
the same way a rollback path is never mistaken for a loop.

`packages/orchestrator/src/run-state-machine.ts`: the pure decisions, provable without a
database. `computeRetryDelayMs` is full-jitter exponential backoff (`random() * min(max,
base * 2^attempt)`), `shouldRetry` compares an attempt count against a step's own `max
Retries`, `hasTimedOut` compares elapsed time against a step's own `timeoutMs`, `next
StepAfterSuccess` reads a step's own `next` (or a branch's evaluated target), and
`compensationChain` walks a run's succeeded-step list in _reverse_ order, yielding only the
steps that actually declared a `compensatesWith`.

`packages/db/src/orchestrator.ts` + a new migration pair (`orchestrator_run`,
`orchestrator_step_run`): the persistence primitives — `openRun`, `getRun`, `listStepRuns`,
`startStepRun`, `finishStepRun`, `updateRunStatus`, `cancelRun`. Both tables are tenant-
owned (added to `TENANT_OWNED_TABLES` in `packages/db/src/tables.ts`) but deliberately
_not_ append-only: a run's `status`/`currentStepId`/`succeededStepIds` and a step's own
`status` mutate in place as the run progresses, the same precedent `brain_write_candidate`
already set for mutable, tenant-scoped workflow state that is not itself a Brain fact.
`(runId, stepId, attempt)` carries a unique constraint, so retrying the same attempt twice
is a database error, not a silent duplicate — the mechanism that makes a step attempt safe
to resume from a fresh read after a crash, rather than something that has to be held in
memory across calls.

`packages/orchestrator/src/runner.ts`: the imperative shell — `startRun`, `advanceRun` (one
unit of work), `runToCompletion` (loops until terminal, paused, or no further progress is
possible), `cancelRun`. Every step attempt opens a tracer span carrying one application-
level `trace_id` attribute, threaded through as a plain field on the run row (the same
pattern `write-path.ts` already uses for Brain writes) rather than relying on OpenTelemetry's
own internal trace context, since `@infinite-ai/telemetry`'s `Tracer` abstraction does not
expose one.

**Durability is proven directly against Postgres, not against BullMQ/Redis, and that is a
deliberate scope line for this step, not a silent gap.** Part 1 describes the orchestrator
as "an in-house DAG runner on BullMQ"; this slice does not wire that in. Every run and step
attempt is a real row, so resumability — the property BullMQ would otherwise provide by
re-delivering a job — is proven here by having `advanceRun` decide its next action purely
from what a fresh read of the run and its step-attempt history says happened, the identical
shape Brain's own write path already uses to prove durability without a queue. BullMQ is
additional infrastructure for distributed _scheduling_ (many workers pulling from one
queue) layered on top of this durable core later, once `apps/worker` has a real consumer to
hand jobs to — building that queue wiring now, with no consumer to drive it, would be
scaffolding with nothing to prove against.

**Only the four step kinds the manual's own reference-pipeline exit gate names are
executed; `branch` and `map` are declared, DAG-validated, and their pure next-step logic
exists, but the runner does not execute them yet.** The manual's worked example for this
stage is explicitly "three agents, one human gate, one compensation path" — `agent_call`,
`tool_call`, `human_gate`, and `compensation` are exactly that set, and all four are proven
end-to-end in `packages/orchestrator/test/runner.integration.spec.ts`. `branch`'s condition
evaluation and `map`'s per-item fan-out are real, additional execution semantics the manual
does not name a worked example for; rather than fake either with a stub that would silently
pass validation and then do the wrong thing at runtime, the runner throws a named
`OrchestratorRunnerError` for `map` and requires an injected `evaluateCondition` for
`branch` — a stated, honest follow-up (the same "mechanism now, full execution once a real
caller exists" shape step 2 already used for `promptExists`/`evalSetExists`), not a
silently dropped feature.

Proven by: `packages/orchestrator/test/dag.spec.ts` (13 tests — reference resolution for
every step kind, missing-target detection, forward-cycle detection, and that a
`compensatesWith` back-edge is correctly excluded from the cycle check);
`packages/orchestrator/test/run-state-machine.spec.ts` (18 tests — retry-delay jitter
bounds and determinism under a fixed `random`, the retry/no-retry boundary at `maxRetries`,
the timeout boundary at `timeoutMs`, `next`/branch-target resolution, and the reverse-order
compensation chain including runs with no compensations declared);
`packages/db/test/orchestrator.integration.spec.ts` (the persistence primitives against a
real Postgres — every status transition each function can produce, the `(runId, stepId,
attempt)` uniqueness constraint, and each function throwing `OrchestratorPersistenceError`
for a run that does not exist); `packages/orchestrator/test/runner.integration.spec.ts` (a
linear pipeline running to `SUCCEEDED` with one `trace_id` on every span; a human gate
pausing the run and staying paused across repeated resumption attempts; a retry that does
not fire before its scheduled time and succeeds once it is due, resumed across separate
`advanceRun` calls rather than a single in-memory loop; a stale `RUNNING` attempt from a
simulated crash correctly detected as timed out and retried on the next call; compensation
running in exact reverse order of success and ending `COMPENSATED`; and a cancelled run
that makes no further progress even when resumption is attempted again). The database-
backed suites were written and typechecked against Prisma's real generated types but not
run against a live container in this sandbox (no Docker registry egress here); they are
proven for real in CI, the same footnote every other Testcontainers suite in this repository
already carries.

Deviations from manual: BullMQ/Redis wiring is deferred to whichever step gives
`apps/worker` a real job consumer, for the reason above; `branch` and `map` are declared
and validated but not executed, for the reason above. Both are named, not silent.

Open questions raised: none.

**What this slice put in place (step 5 — Human-in-the-loop gates)**

Step 4 built the pause point (`human_gate`'s own comment named this step explicitly: "The
approval task itself, the diff, the evidence and the required-role enforcement are step
5's job"). This step builds the approval task itself.

`packages/db/prisma/schema.prisma`'s new `ApprovalTask` model + a migration pair
(`approval_task`, `approval_decision` enum): one row per `(runId, stepId)` — a run only
ever reaches a given gate once, the same guarantee `dag.ts`'s forward-cycle check already
gives every other step. `decision` is null while pending and set exactly once;
`packages/db/src/approval.ts`'s `openApprovalTask`/`getApprovalTask`/
`getApprovalTaskForStep`/`decideApprovalTask` are the persistence primitives, following
`orchestrator.ts`'s own division of labour precisely: `decideApprovalTask` only records a
decision, the same "never touches the run's own status" boundary `finishStepRun` already
draws, so recording a decision and deciding what it means for the run are two separate
calls. Tenant-owned, but — like `orchestrator_run`/`orchestrator_step_run` — deliberately
not append-only: the permanent, immutable record that a decision was made is the
`audit_event` row `decideHumanGate` also appends in the same transaction, not this row
itself (`packages/db/src/tables.ts`'s own comment now says so directly).

`packages/orchestrator/src/runner.ts`: `advanceRun`'s `human_gate` branch now calls an
injected `prepareApproval` function — required, the same "mechanism now, no faking the
content" rule `branch`'s `evaluateCondition` already set in step 4 — to get "the artefact,
a diff against the previous version, the evidence used" before opening the task and
pausing the run. A new `resumeFromHumanGate` runs on every subsequent `advanceRun` call
while a run sits `WAITING_FOR_APPROVAL`: it re-reads the approval task fresh from Postgres
every time (no decision held in memory across calls, the same resumability rule
everything else in this runner already follows), makes no progress while it is still
pending, proceeds to the gate's own `next` on an `APPROVED` or `EDITED` decision, and
routes a `REJECTED` decision into `runCompensation` — the same path an exhausted retry
already takes, since a human declining an artefact is, structurally, exactly that: the
step failed. `decideHumanGate` is the one exported entry point that records a decision:
Zod-validated input (a recognised outcome, a real actor id, a non-empty reason — "the
decision, the actor, the reason... are recorded" reads as unconditional, not only for a
rejection), a check that the run is actually `WAITING_FOR_APPROVAL` with an open,
undecided task, a role check, and — only once all of that holds — the decision itself plus
one `human_gate_decided` audit event carrying who decided what and why, never the
artefact's own content (the same boundary `brain/write-path.ts`'s own `ratify` already
holds its audit event to).

**The required-role check is a direct `role_assignment` lookup, not `packages/policy`'s
`authorize()`.** `authorize()` (Stage 02/03) answers a _data-access_ question — can this
actor, holding these grants, touch this resource for this purpose — and expects a caller
that has already assembled an `Actor` with its grants attached; nothing about a workflow
gate's "does this actor hold this one named role" needs a `Resource`, a `Purpose`, or the
POPIA lawful-basis machinery `authorize()` exists to apply. `packages/db/src/roles.ts`'s
new `hasActiveRoleAssignment` answers the narrower question directly: does an unexpired
`role_assignment` row for this role exist for this actor, in this tenant. Reusing
`authorize()` here would have meant inventing a resource/purpose pair with no referent
just to satisfy a function signature built for a different job.

**An edit's diff is recorded, not fed forward.** The manual's own text asks only that "the
edit diff... [is] recorded" — it is, on the `ApprovalTask` row, as the stated "first-class
training signal for Stage 13." Feeding an edited artefact into the _next_ step's own input
would need per-step output-chaining this runner does not have yet (every step today reads
the run's original `input`, not a previous step's output — a simplification step 4 already
made and did not revisit here). Recording without forwarding is therefore this step's own
honest scope line, not an oversight: `EDITED` behaves exactly like `APPROVED` for run
progression, and the diff sits durably on the task row for whatever later consumes it.

Proven by `packages/db/test/approval.integration.spec.ts` (every field an opened task
carries, `diffAgainstPrevious` defaulting to null with nothing to diff against, the
`(runId, stepId)` uniqueness constraint, each of the three decision outcomes recorded with
its own fields, the "decided once" guard, and `hasActiveRoleAssignment`'s active/expired
boundary) and `packages/orchestrator/test/runner.integration.spec.ts`'s three new describe
blocks: "a human gate" (extended to assert the opened task's own artefact/evidence/role),
"human gate decisions" (an approval and an edit each proceeding to the next step with the
edit diff recorded; a rejection with nothing to compensate ending `FAILED`; a rejection
rolling back an earlier step through compensation), and "human gate bypass vectors" — the
manual's own "assert this with a test that attempts every bypass vector," made concrete as:
an actor lacking the required role is refused and leaves the task undecided; a second
decision on an already-decided task is refused and the first decision stands unchanged;
deciding a run that has not yet reached `WAITING_FOR_APPROVAL` is refused; an empty reason
is refused; and a `human_gate` step with no `prepareApproval` supplied refuses to execute
at all rather than silently letting the run past with no real review recorded. The
database-backed suites are written and typechecked against Prisma's real generated types
but not run against a live container in this sandbox, proven for real in CI — the same
footnote every other Testcontainers suite in this repository carries.

Deviations from manual: none. The required-role check bypasses `authorize()` for the
reason above, and an edit's diff is recorded without being fed forward for the reason
above — both are scope decisions the manual's own step 5 text leaves open, not departures
from anything it actually specifies.

Open questions raised: none.

**What this slice put in place (step 6 — the Guardrail engine)**

`packages/guardrails/src/refusal.ts`: the one typed `Refusal` result every check in this
package returns — `code` (a closed `RefusalReasonCode` enum), `explanation` (a required,
non-empty user-facing string) and `escalation` (`EscalationRoute | null`). `GuardrailVerdict`
is `{ passed: true } | { passed: false; refusal: Refusal }` — a decision, never a thrown
error for the ordinary case, the same reasoning `packages/policy/src/access.ts`'s own
`resolveAccess` already gives for a purpose/consent drop. `RefusalReasonCode` reuses the
exact reason strings `pii-guard.ts`'s `EgressRefusal` and `packages/policy`'s `DropReason`
already produce rather than renaming them, with a compile-time-only check
(`AssertSubset`) that fails to typecheck if either vocabulary grows a value this file
forgets to add.

`packages/guardrails/src/input-checks.ts` (the manual's five input checks, three of them
composing what already exists rather than rebuilding it): `checkInputSchema` (a plain Zod
`safeParse`); `checkPurposeAndConsent`, which calls `packages/policy`'s own `resolveAccess`
(Stage 03 step 3) and refuses if any category this call actually requires was dropped —
not merely "requested", since `resolveAccess` itself is a projection and a caller can ask
for more than it strictly needs; `checkPii`, a thin wrapper over `inspectEgress` (Stage 03
step 5); `checkPromptInjection` (new — see below); and `checkTokenBudget`, reusing the
exact `Math.ceil(text.length / 4)` heuristic `packages/brain/src/retrieval-assembly.ts`'s
own `estimateTokens` already established, for the same reason: a real tokenizer is a
dependency this stage does not yet justify, and a conservative overestimate still
guarantees the budget is never silently exceeded.

`packages/guardrails/src/prompt-injection.ts`: a rules-based detector — eighteen named,
narrow regex patterns across four families (direct instruction override, role/system
impersonation, exfiltration of the hidden context, and encoding tricks including a
zero-width-character class) — checked against every text a call would send to a model,
retrieved documents and user-supplied text alike, since the manual names both. A match
refuses the whole call outright rather than attempting to strip the offending span and
continue: "sanitising" an injection in place would mean guessing which part of a retrieved
document is safe to keep, the same silent-recovery failure mode rule 4's own reasoning (in
`pii-guard.ts`) already rejects for PII. Proven against 34 distinct payloads in
`test/prompt-injection.spec.ts` — the manual's own step 10 asks for "at least 30... all
neutralised"; this is that proof, built here rather than deferred.

`packages/guardrails/src/readability.ts`: a real Flesch-Kincaid Grade Level calculator —
`0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59` — with a heuristic
vowel-group syllable counter, the same "a real, computable metric, honestly approximate
where exactness needs a dependency this stage does not justify" bar the token estimate
already sets. A very short, simple sentence can legitimately score below zero under this
formula; that surfaced in this slice's own tests as a fixture bug (an assumed `minGrade: 0`
range), not a defect in the arithmetic, and the tests were corrected rather than the
formula bent to match a wrong expectation.

`packages/guardrails/src/output-checks.ts` (the manual's seven output checks):
`checkOutputSchema` (Zod, symmetric with the input side); `checkGrounding`, which does not
extract claims from free text — that is real NLP work this stage does not build — but
takes the citation ids an agent's own structured output already declares and refuses the
first one that does not resolve against the ids actually available to cite (retrieved-fact
ids from `packages/brain`'s `RetrievalCandidate.id`, unioned with any CAPS
`SourceRef.clause` reached for the call); `checkReadability`, wrapping the calculator
above against a caller-declared grade band; `checkRefusalPolicy`, which validates a
claimed refusal's own shape when `claimedRefusal` is not null and passes trivially when it
is (nothing to check); and `checkCost`, symmetric with the input side's token check.
**Two checks are real mechanisms with no built-in rule:** `checkTemplateFidelity` and
`checkAgeAppropriateness` each take an optional injected checker and pass every output
when none is supplied — not a silent guarantee, but the same "mechanism now, real check
wired in once the source exists" shape `packages/agents/src/registry.ts`'s
`promptExists`/`evalSetExists` already established in step 2. Neither has a source this
codebase can validate against yet: `docs/OPEN_QUESTIONS.md` OQ-003 already asks for the
school's own artefact templates before template-fidelity can be built for real; OQ-015
(new, this step) asks the same question for an age-appropriateness content policy —
inventing either would be exactly the kind of unsourced policy rule 0.3 forbids for
curriculum content, applied here to content-suitability rules instead.

`packages/guardrails/src/engine.ts`: `runInputGuardrails`/`runOutputGuardrails` run each
side's fixed pipeline in the manual's own order and stop at the first refusal — the same
"gates in a fixed order, first failure wins" shape `resolveAccess`'s three-gate order
already established, applied across every check this stage builds. Each phase wraps one
trace span (Definition of Done: "emits a trace span"), with one `addEvent` per check
naming it and whether it passed. `AgentContract.guardrails` (step 1) names additional
checks a specific agent runs beyond this fixed set; resolving those names to real
functions is a stated follow-up for whichever module first declares one — nothing exists
yet to resolve.

**Refusal and escalation, made structural rather than merely typed.** Whenever either
phase's resulting refusal carries a non-null `escalation`, the engine awaits an
`EscalationNotifier` before returning — "pages a named human immediately and never
queues" made concrete as an absence: there is no queue, no worker, nothing to enqueue
onto, only a direct, awaited call. **None of this engine's own built-in mechanical checks
ever set an escalation route** — a schema failure, a budget overrun or a dangling citation
is not a safeguarding concern, and inventing a taxonomy of safeguarding categories to
attach to one would be exactly the unsourced-policy problem `EscalationRoute.category`'s
own comment already refuses to do (a free string, not a closed enum, for the same reason
`AgentModule`'s own pattern is a shape rather than an enumerated list). The mechanism
exists for whenever a real safeguarding-detecting check is added later — proven in tests
via the injectable `ageAppropriatenessChecker`, the one lever available today that can
construct an escalating refusal at all.

**`defaultEscalationNotifier` throws rather than silently succeeding.** No paging
integration (SMS, phone, PagerDuty or similar) is available in this build — it needs a
third-party account this environment does not have, recorded as OQ-014 (new, this step).
A silent no-op default would be worse than the gap it papers over: an escalation that
"succeeded" without reaching anyone. Throwing `GuardrailEscalationError` means a
deployment that has not wired a real notifier finds out at the moment it would matter, the
same fail-loud-not-silent philosophy `pii-guard.ts` already holds for a payload with no
provenance stamp.

**No `@infinite-ai/db` dependency, and no audit-ledger entry written here.** The Definition
of Done also asks for "where relevant... an audit-ledger entry"; this engine does not
write one, because nothing yet calls it at a point where a tenant transaction is already
open to append one into — that wiring belongs to whichever call site first invokes a real
agent (Stage 06's own agent-runtime integration, not yet built). A trace span is real and
present now; the audit entry is a stated follow-up for that caller, the same "mechanism
now, real caller later" shape this stage has used throughout.

Proven by 150 tests across seven files: `test/prompt-injection.spec.ts` (34 distinct
payloads across four technique families, all refused, plus benign multi-document text
passing clean); `test/readability.spec.ts` (the empty-text zero case, short-versus-complex
ordering, and the no-closing-punctuation edge case); `test/input-checks.spec.ts` and
`test/output-checks.spec.ts` (every one of the twelve checks, both its passing and its
refusing path, with the exact reason code asserted); `test/engine.spec.ts` (full-pass
composition, fail-fast ordering across two simultaneously-failing checks, one trace span
per phase, escalation awaited before a refusal is returned, and `defaultEscalationNotifier`
throwing rather than silently succeeding); and the existing `test/pii-guard.spec.ts` (99
tests, untouched). `test/exports.spec.ts` extended to the full new surface, still asserting
no export name contains `bypass`, `allowlist`, `force`, `skip`, `override` or `disable`.

Deviations from manual: none in what is checked. Two checks (`checkTemplateFidelity`,
`checkAgeAppropriateness`) are real mechanisms without a built-in rule because this
codebase has no source to validate against yet (OQ-003, OQ-015) — the same honest gap
pattern this stage has used repeatedly, not a silently lowered bar. Escalation paging
needs a real third-party integration this build does not have (OQ-014) and fails loudly
rather than pretending to succeed.

Open questions raised: OQ-014 (escalation paging needs a real integration), OQ-015
(age-appropriateness needs a supplied content policy).
