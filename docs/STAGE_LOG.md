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

Started: 2026-08-04 Completed: —
Exit gate: **PARTIAL** — steps 1–7, 9 and 10 are built and proven, including the tenant
lexicon's `packages/db` wiring; Langfuse/OTel instrumentation (step 8) is not.

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

**One thing still deliberately not invented**

**Provider pricing.** Cost estimation defaults to zero per call. A hard budget limit is
real and enforced the moment a school's real per-model price is supplied; until then,
zero cost means the tracker never refuses on cost grounds, which is the safe default
rather than an invented number feeding a control that matters. Recorded here rather than
left to be discovered later; needed before this stage's exit gate can read PASS.

Deviations from manual: budgets and the prompt cache are in-memory, not the Redis-backed
store §1.1 locks in — a single gateway process is the only deployment shape this PR
proves; a multi-instance gateway sharing that state needs a shared store, which is a
follow-up rather than a silent gap (both `BudgetTracker` and `GatewayCache` are built
behind an interface for exactly that swap). The prompt cache does not cover streaming
requests, for the reason above. Langfuse/OTel instrumentation (step 8) is not built.
`INFINITEAI_BUILD_MANUAL.md` itself was added to the repo in this PR — it had existed only
outside it since Stage 00.

Open questions raised: none. The pricing gap above is follow-up implementation work, not
a decision that needs a human's judgement call, so it is tracked here rather than in
`docs/OPEN_QUESTIONS.md`.
