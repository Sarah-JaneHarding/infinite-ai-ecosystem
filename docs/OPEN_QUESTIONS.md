# Open questions

Part 0 §0.3: stop work, write the question here, and ask, whenever a requirement conflicts
with another, a credential or source document is missing, an operation would be
irreversible, a control would have to be weakened, a CAPS / ATP / SIAS / SACE rule is
ambiguous, PII would be needed in a prompt, an exit gate cannot be met, or a stage would
overrun its budget by more than 30%.

**Never invent curriculum policy, assessment weightings, SIAS process steps or CPTD point
values.** If it is not in a supplied source document, it goes here.

| ID     | Raised     | Stage | Status                | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------- | ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-002 | 2026-07-28 | 08    | PARTIALLY ANSWERED    | Scope confirmed 2026-07-29: full primary, Grades R-7, across all three phases. **Update 2026-08-18:** 21 CAPS documents ingested — all core subjects for Grades R-7. **Update 2026-08-19 (first pass):** DBE ATP database ingested — 26 source documents with topic data (425 topic blocks, 208 FAT rows), covering Grades R-7 across Mathematics, English HL/FAL, Life Skills, NST, Social Sciences, Life Orientation, EMS, Natural Sciences, and Technology. **Update 2026-08-19 (second pass):** 11 additional sources ingested — Gr 4-6 English HL/FAL and Creative Arts (multigrade), Gr 7 Creative Arts (4 strands). **Update 2026-08-20 (third pass):** 93 additional sources ingested from fully-parsed DBE database (817 topic blocks, 600 FAT rows across 155 sources) — all Afrikaans HL/FAL (Gr 1-7), all Life Skills languages (10 languages × Gr 1-3), all IP non-English HL/FAL (6 languages × Gr 4-6), all SP non-English HL/FAL (6 languages × Gr 7). Phase files now cover 136 sources: FP 57 sources (239 topics, 195 FATs), IP 55 sources (380 topics, 253 FATs), SP 24 sources (198 topics, 152 FATs). 20 per-term FP English sources remain consolidated into annual IDs. `ATP_PENDING_REGISTRY` reduced to 5 stubs: IP-MULTI HL/LS/MATHS/NST/SS-2023 (topic data not yet in DBE database). Remaining before OQ-002 is fully closed: (a) ingest the 5 IP-MULTI multigrade stubs when DBE publishes their topic data; (b) `ratifiedBy` is `null` on all SourceRefs until a human countersigns. |
| OQ-003 | 2026-07-28 | 08    | PARTIALLY ANSWERED    | **Update 2026-08-19:** Benjamin Pine Primary School's 2026 Lesson Plan Preparation Template supplied and ingested. Machine-readable `TemplateDefinition` at `packages/contracts/src/curriculum/sources/template-lesson-plan-benjamin-pine.ts` (exported as `LESSON_PLAN_TEMPLATE_BENJAMIN_PINE`). `ratifiedAt: null` until principal or designate countersigns. Remaining: unit blueprint, assessment task, rubric/marking memo, and parent progress report templates still needed from the school.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| OQ-004 | 2026-07-28 | 01    | RESOLVED (2026-08-13) | Tenant shape for the seed data: the manual asks for a small primary, a large primary and a school group with two campuses. Should the seed model Benjamin Pine Primary specifically, or stay generic until a pilot tenant is confirmed? **Answer:** Stay generic until a pilot tenant is confirmed. See Resolved section below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

| OQ-005 | 2026-07-29 | 08 | RESOLVED (2026-08-13) | CAPS statements, ATPs and DBE policy documents are Crown-copyright government publications. Redistributing them inside a multi-tenant SaaS product is a licensing question, not a technical one, and it is cheaper to settle before they are embedded in every tenant's L0. **Answer:** Rely on DBE terms for educational reuse; store derived structure only (topic graphs, clause identifiers), not source text. Documents are not stored in the repository. See Resolved section below. |
| OQ-006 | 2026-07-29 | 12 | PARTIALLY ANSWERED | SACE CPTD point-value schedules are needed for PD-08, which may not compute them. Same supply problem as OQ-002. **Update 2026-08-13:** The SACE PD Points Schedule has been supplied and ingested — 150 PD Points per 3-year CPTD cycle across three activity types (Type 1 Teacher-Initiated, Type 2 School-Initiated, Type 3 Externally-Initiated). Derived structure at `packages/contracts/src/policy/sources/sace-pd-points-schedule.ts`. Remaining gap: individual activity-level point tables for Type 1 activities and SACE provider-accreditation criteria — needed for MOD-05's automatic point-logging. |
| OQ-007 | 2026-07-29 | 03 | PARTIALLY ANSWERED | **Retention periods per data category.** POPIA §14(1) forbids keeping personal information longer than necessary "unless a law requires otherwise", and for a school that clause does most of the work — admission registers, attendance registers and mark schedules carry statutory periods set outside this system. `packages/contracts` ships the shape of a schedule and the arithmetic to evaluate it, and deliberately ships no periods; a test asserts it stays that way. Until a school ratifies rules, nothing is tombstoned automatically and every unscheduled category is reported on each retention run. **Three things are needed per category: how long, measured from which event, and on whose authority.** A ratification form is ready at `docs/RETENTION_SCHEDULE_TEMPLATE.md`, and `pnpm check:retention` validates a filled-in copy before it is loaded. Blocks the nightly retention job; blocks nothing already built. See `docs/POPIA.md` §5.1. **Update 2026-08-31 (demo/pilot release):** the actual legal determination is still each school's own — that has not changed and will not. What's new is a per-tenant path to a _starting_ schedule for the demo release: `packages/contracts/src/popia/retention-demo-defaults.ts`'s `DEMO_RETENTION_ESTIMATES` (one round-number estimate per `DataCategory`, each `authority` explicitly labelled `"INFINITE-AI DEMO ESTIMATE — not a legal citation"`) and `buildDemoRetentionSchedule(tenantId, ratifiedBy, now, overrides?)`, which only ever produces a real `RetentionRule`/`RetentionSchedule` when handed a real `ratifiedBy`/`ratifiedAt` — never invented by the function itself. `packages/db/src/retention.ts` gained the write side, `upsertRetentionRule`, so that acceptance actually persists (one row per tenant/category, ratified or re-ratified). The part that makes this "per school, part of onboarding" rather than a silent default: `packages/provisioning`'s onboarding wizard now has a required `ratify_retention_schedule` step (between `ratify_constitution` and `readiness_check`, validated against `@infinite-ai/contracts`' own `RetentionSchedule`), and `runReadinessChecks` refuses go-live readiness without `hasRetentionScheduleRatified`. A school accepts the estimates as-is, overrides individual categories before accepting, or ignores all of it and fills in `docs/RETENTION_SCHEDULE_TEMPLATE.md` for real — either way, nothing is adopted without a human action at that specific tenant. What remains open, unchanged from before: the estimates are still estimates, not legal citations, and a school's real governing-body determination (the actual close of this OQ) is still outstanding. |
| OQ-014 | 2026-08-05 | 06 | OPEN | **Safeguarding escalation needs a real paging integration.** Stage 06 step 6's guardrail engine (`packages/guardrails/src/engine.ts`) can attach an `EscalationRoute` to a refusal for a safeguarding concern, and the manual's own text requires that route to "page a named human immediately and never queue." This build has no credentialed third-party paging account (SMS, phone, PagerDuty or similar) to actually reach anyone, so `defaultEscalationNotifier` throws `GuardrailEscalationError` rather than silently pretending to have paged someone — a real integration is a required follow-up before any pipeline that can produce a safeguarding-relevant refusal goes live. Which service, and whose account, is a decision for a human to make. **Update 2026-08-25:** a production-readiness audit found the escalation path had no caller at all — `apps/worker`'s real agent-call path never invoked the guardrail engine, so even a fully-credentialed notifier could not have fired. `apps/worker/src/step-executor.ts` now calls the check and dispatches to a configurable `notify` (defaulting to `defaultEscalationNotifier`) after every agent call. The only remaining gap is exactly what this question already named: a real provider and account. |
| OQ-015 | 2026-08-05 | 06 | OPEN | **Age-appropriateness needs a supplied content policy.** The same guardrail engine's `checkAgeAppropriateness` is a real mechanism with no built-in rule — this codebase has no ratified wordlist, classifier or content-suitability policy by grade, and inventing one would be exactly the kind of unsourced policy rule 0.3 already forbids for curriculum content. It defaults to passing every output until a real policy is supplied and wired in as an injected checker, the same gap OQ-003 already names for template-fidelity checking. **Update 2026-08-25:** now actually invoked on every agent call's output (`apps/worker/src/step-executor.ts`, same audit as OQ-014) via a configurable `ageAppropriatenessChecker`, currently unset so behaviour is unchanged (every output still passes). Supplying a real checker, once the policy exists, now takes effect with no further code change. **Update 2026-08-28:** a human supplied real source material — 206 paraphrased developmental-readiness clauses across 23 DBE CAPS documents (`docs/sources/pedagogy/age-appropriateness-developmental-readiness/SOURCES.md`) — now ingested into L0 (`AGE_APPROPRIATENESS` a new `BrainConstitutionKind`, `packages/brain/src/age-appropriateness.ts`, seeded via `pnpm age-appropriateness:seed`/`:ratify`). This resolves the "no source material exists" half of the gap, not the whole OQ: `ageAppropriatenessChecker` is still unset, and wiring a real checker against this data needs a breaking, async-aware signature change to `AgeAppropriatenessChecker` (currently synchronous) and its call site in `apps/worker/src/step-executor.ts` — a separate follow-up, not undertaken here since it wasn't what was asked. **Update 2026-08-28 (later the same day):** that breaking change is now done — `AgeAppropriatenessChecker` is async, `checkAgeAppropriateness`/`runOutputGuardrails`/`step-executor.ts`'s call site all await it — and `packages/guardrails/src/brain-age-appropriateness.ts`'s new `createBrainAgeAppropriatenessChecker` is a real, tested implementation that retrieves the ratified clauses for a given phase via `recall()` and passes them to an injected `AgeAppropriatenessJudge`. What remains open, and is the actual reason `apps/worker`'s default wiring still leaves `ageAppropriatenessChecker` unset: (1) nothing in the generic agent-call path (`PipelineJobData`, `StepExecutionContext.input: unknown`) carries a phase/grade for an arbitrary agent call — no agent contract declares one, so there is no honest way to pick which of the 206 clauses apply without a specific pipeline supplying that context itself; (2) `AgeAppropriatenessJudge` needs a real Model Gateway call to actually render a verdict from the retrieved clauses (the same "mechanism now, real model call once a caller with its own prompt/eval set/cost budget exists" gap `packages/evals`' own `LlmJudge` already has, per OQ-016) — no judge implementation exists yet. Both are real, separate design decisions, not guessed at here. |
| OQ-016 | 2026-08-06 | 07 | OPEN | **The LLM-as-judge scorer has no calibration data.** Stage 07 step 2's own text requires the judge to be "calibrated against at least 50 human-labelled cases, and re-calibrated whenever its own model changes" — this build has neither a labelled dataset nor a calibration workflow, and inventing either would be exactly the kind of unsourced process rule §0.3 forbids. `packages/evals/src/scorers.ts`'s `scoreLlmJudge` builds the mechanism (an injected `LlmJudge` function a real caller wires to an actual Model Gateway call) and stops there — it neither performs nor claims a calibrated judgement. Needs: 50+ human-labelled cases sourced per module, a calibration procedure, and a decision on which logical model the judge itself should call through the gateway. Blocks trusting `llm_judge` expectation results for real promotion decisions (step 4); blocks nothing already built. |
| OQ-017 | 2026-08-12 | 18 | OPEN | **k6 load tests need a live environment.** Stage 18 step 2 requires load testing at 3× expected peak (450 concurrent learners, Starter tier) and a spike test for term-start ingest and Sunday-evening lesson-planning. `scripts/load/k6-peak.js` and `scripts/load/k6-spike.js` are ready to run but cannot run in the authoring sandbox — they need a running gateway and data plane with realistic seed data. Must be executed manually against the staging environment before GA. |
| OQ-018 | 2026-08-12 | 18 | OPEN | **Cost model needs real gateway telemetry.** `docs/COST_MODEL.md` uses estimated token counts based on typical artefact types. Actual costs depend on real usage patterns. After the first pilot month, `tenant_metering_event` data should be used to recalibrate all per-artefact estimates and update the cost model. Blocks a precise pricing decision for post-pilot tiers. |
| OQ-019 | 2026-08-12 | 18 | OPEN | **Pilot schools have not been identified.** `docs/PILOT_PROTOCOL.md` targets 3 schools (small primary, large primary, school group). None have been confirmed. The on-call rotation and PagerDuty integration (OQ-014) must both be resolved before pilot onboarding begins. Blocks the Stage 18 exit gate item "pilot protocol agreed with at least one school." |
| OQ-020 | 2026-08-12 | 18 | OPEN | **Architecture walkthrough recording.** Stage 18 step 7 requires a recorded architecture walkthrough (screen + audio) covering the nine-layer diagram, the four invariants, the test strategy, and the feature-flag procedure. This cannot be produced in the authoring environment (no recording capability). Must be done by a human using `docs/HOW_TO_ADD_AN_AGENT.md` as the worked example. |
| OQ-021 | 2026-08-12 | 18 | OPEN | **Dunning emails need a transactional email provider.** The `billing_dunning_emails` feature flag gates automated OVERDUE/SUSPENDED notifications. No credentialed email provider (SendGrid, AWS SES, or similar) has been configured. OQ-014 (paging) and this question should be resolved together — the same provider likely serves both. |
| OQ-022 | 2026-08-12 | 17 | OPEN | **POPIA erasure for append-only tables.** `audit_event`, `consent_record`, and `tenant_metering_event` carry BEFORE DELETE triggers that refuse all deletes, including CASCADE deletes from `tenant`. On tenant closure, only mutable tables are erased; append-only ledgers are retained under legal-obligation and POPIA compliance bases. Three decisions are needed: (1) Which data categories in these tables constitute "personal information" under POPIA §1? (2) Is pseudonymization (replacing `actor_id` and `subject_token` with a replacement token) the correct erasure technique, and if so what replaces them? (3) Which specific retention periods apply to audit and consent records for South African schools? Until resolved, append-only data is retained indefinitely on tenant closure. See `docs/POPIA.md` and `docs/COST_MODEL.md`. |
| OQ-023 | 2026-08-20 | 29 | OPEN | **`GradeFramework` needs `hoursPerWeek` and `assessmentWeighting` data.** `GradeFramework` in `@infinite-ai/contracts` requires `time.hoursPerWeek` (a Sourced, required field) and `assessment` (SBA/exam splits per component, similarly Sourced). Neither field is present in any of the 21 CAPS source files ingested into L0 in Stage 29 — those files record topic-area names, content areas, and term-level weightings, but not per-subject time allocations or formal SBA/exam splits at the grade-level. CE-01 can populate `contentAreas` from L0 `CAPS_CANON` records but will continue to return `NEEDS_INPUT` for a complete `GradeFramework` until these fields are supplied. Source documents needed: CAPS Policy section-level time-allocation tables (typically an appendix per subject/phase document) and the CAPS Assessment Policy for each phase. These have not been supplied. |
| OQ-024 | 2026-08-24 | 06 | RESOLVED (2026-09-01) | **`branch` step conditions cannot see a prior step's actual output.** `evaluateCondition` only ever received `run.input`, never what an intervening agent produced, even though every `branch` step is narrated as reading one specific prior step's output. **Answer:** derive it structurally — no migration, no new field. See Resolved section below. |
| OQ-025 | 2026-08-25 | 16 | RESOLVED (2026-08-25) | The per-request CSP nonce did not reach the client on `/sign-in`. **Answer:** root cause was `next-auth@4.24.15`'s `withAuth()` unconditionally short-circuiting before the wrapped handler for the sign-in page. See Resolved section below. |
| OQ-026 | 2026-08-25 | 06/10 | RESOLVED (2026-09-01) | **`checkDiagnosticLanguage` has no caller.** Needed to know which of a MOD-02 agent's own output fields are free text before it could be wired in for real, without guessing. **Answer:** a field allow-list per agent contract, the human's own choice between two named options. See Resolved section below. |
| OQ-027 | 2026-09-01 | 06/10 | OPEN | **`support.needs_referral`'s SIAS-status field has no ratified shape.** Found while resolving OQ-024: `mod-02.ts`'s `branch-on-referral` is narrated as evaluating "whether any monitored learner has reached REFERRAL_PENDING SIAS status," but its predecessor step (`check-fidelity`, a `map` over AC-07 fidelity checks) never produces that — `AC07Result` (`@infinite-ai/analytics`) has no `siasStatus` field, and no schema anywhere in `@infinite-ai/contracts` or `@infinite-ai/analytics` declares what an `activeInterventions` collection item carries. Whatever the real source is (each item carrying its own `siasStatus`, a separate collection alongside `activeInterventions` in the run's own input, or a fresh read from the SIAS state machine at branch time — a capability `evaluateCondition` does not have today), inventing a field name to unblock this one condition risks exactly the "silently read stale/absent fields" failure OQ-024 itself flagged. `apps/worker/src/condition-evaluator.ts`'s `evaluateCondition` implements the other four conditions for real (each reads a field a ratified Zod schema already fixes) and throws `UnresolvedConditionError` for this one rather than guessing. **Decision needed:** what shape carries a monitored learner's current SIAS status into the MOD-02 Monitoring pipeline, and where it is read from. Blocks real branching in MOD-02 Monitoring only; blocks nothing else, since MOD-02 RTI, MOD-05 PD Analysis and LE Commons are all resolved. |

### Phase 4 — proposed extension (Stages 19-25), not in the original 18-stage manual

Surfaced by `INFINITEAI_TASK_LIST.md` (uploaded 2026-08-05), which proposes seven
additional stages after Stage 18 — a visual AI-workflow builder, a prompt workshop, a
system-instruction workshop, live classroom quizzes, a low-tech card-scanning assessment
mode, collaborative document annotation, and a dedicated learner app — to bring
INFINITE-AI to parity with tools like Kahoot, Plickers and Kami. None of OQ-008 through
OQ-013 block current work: the build is still in Stage 05, and Phase 4 does not start
before Stage 18 passes its exit gate. They are recorded now so they are decided
deliberately, not defaulted into, when that time comes.

| ID     | Raised     | Stage | Status              | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------- | ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-008 | 2026-08-05 | 19    | OPEN                | Should the visual AI-workflow builder be its own package (`@infinite-ai/agent-builder`) or built inside `packages/agents`? A separate package is cleaner to maintain on its own timeline; integrating it avoids keeping workflow state in two places.                                                                                                                                                                                                                               |
| OQ-009 | 2026-08-05 | 22    | OPEN                | Should live classroom quiz games (Stage 22) be a standalone product area, or folded into MOD-04's teaching-and-learning toolkit (Stage 11)? Standalone gets more visibility and dedicated resourcing; folding it in fits the module structure already in place.                                                                                                                                                                                                                     |
| OQ-010 | 2026-08-05 | 25    | RESOLVED (Stage 26) | Should the learner-facing app (Stage 25) be a separate PWA, or built into the same `apps/web` every other role uses? **Decision: integrated into `apps/web`.** The `packages/learner-client` data model is UI-shell-agnostic; a native PWA shell can be added later (OQ-010b) if offline-first requirements harden. The integrated approach shares auth, the design system, and the shell without additional infrastructure. PWA manifest added at `apps/web/public/manifest.json`. |
| OQ-011 | 2026-08-05 | 10/19 | OPEN                | Where should SIAS documentation and workflow live long-term — inside MOD-02 Support Analytics (Stage 10, where it is currently planned), or split into its own module for more room to grow independently?                                                                                                                                                                                                                                                                          |
| OQ-012 | 2026-08-05 | 20/21 | OPEN                | Should the Master Prompt Builder (Stage 20) and System Prompt Builder (Stage 21) be one combined tool or two separate ones? Separate is clearer about what each does; combined is a simpler experience over shared infrastructure.                                                                                                                                                                                                                                                  |
| OQ-013 | 2026-08-05 | 08    | OPEN                | Eight of South Africa's eleven official languages, and Grades 10-12 entirely, are still missing from the CAPS documents supplied so far (see OQ-002). Sepedi, Sesotho and Setswana would serve the largest remaining population. Prioritise sourcing these before Stage 08 is considered feature-complete, or launch with what's supplied and add the rest afterward?                                                                                                               |

## Resolved

### OQ-004 — tenant seed data shape · resolved 2026-08-13

**Question.** The manual asks for a small primary, a large primary and a school group
with two campuses. Should the seed model Benjamin Pine Primary specifically, or stay
generic until a pilot tenant is confirmed?

**Answer.** Stay generic until a pilot tenant is confirmed. The seed data uses
placeholder names (`Placeholder Primary A`, `Placeholder Primary B`,
`Placeholder School Group`). Benjamin Pine Primary or any real school's data is loaded
only when that school has signed up as a pilot tenant (see OQ-019).

### OQ-005 — Crown-copyright licensing for DBE documents · resolved 2026-08-13

**Question.** CAPS statements, ATPs and DBE policy documents are Crown-copyright
government publications. Redistributing them inside a multi-tenant SaaS product is a
licensing question. Options: rely on DBE terms for educational reuse; have each school
supply its own copies; or store only derived structure.

**Answer.** Rely on DBE terms for educational reuse and store **derived structure only**
(topic graphs, clause identifiers, section references) — not source text. No PDF or
document text is committed to the repository; `docs/sources/` contains only the
provenance metadata (`SOURCES.md` files) that records where each document came from, not
its content. This is the approach taken in Stages 08 and 26 for both CAPS and policy
ingestion.

### OQ-001 — where the platform lives · resolved 2026-07-29

**Question.** The GitHub integration could not create a repository, so the monorepo was
scaffolded under `infinite-ai/` inside `curriculum-saas-`. Create a dedicated repository
and spin it out, or leave it as a subdirectory?

**Answer.** Create it. `Sarah-JaneHarding/infinite-ai-ecosystem` now exists and the
monorepo was moved to its root via `git subtree split`, carrying all five Stage 00 and
Stage 01 commits. `scripts/spin-out-repo.sh` has served its purpose and is deleted.

This also retires the subdirectory workaround that caused the Stage 00 git-hook defect:
the package root and the git root are now the same directory, which is what Husky assumes.
`scripts/install-hooks.mjs` stays, because it is correct in both layouts and the hooks it
installs are what caught that defect's recurrence.

### OQ-025 — CSP nonce not reaching the client on `/sign-in` · resolved 2026-08-25

**Question.** An unauthenticated request to `/sign-in` carried every static security
header from `next.config.ts` but no `Content-Security-Policy` header — the one
`apps/web/src/proxy.ts` is supposed to set per-request. Root cause not established at the
time this was raised; `next-auth@4.24.15` predates Next.js 16's Proxy convention entirely,
and no test anywhere exercised the real request path to catch this.

**Answer.** Root-caused by reading `next-auth`'s own installed source
(`next-auth/src/next/middleware.ts`). `withAuth()`'s internal `handleMiddleware`
unconditionally `return`s — **before ever invoking the wrapped handler** — for any request
whose path matches the configured sign-in page, error page, or `NEXTAUTH_URL`'s auth path.
This is a deliberate anti-redirect-loop guard in `next-auth` itself, not something our own
`authorized` callback could see or override: it fires regardless of what that callback
returns. Since the CSP nonce was only ever generated inside the wrapped handler, `/sign-in`
never got one.

**Fix.** `apps/web/src/proxy.ts` no longer uses `withAuth()`. It computes the CSP nonce
unconditionally, on every matched request, then gates access itself using
`getToken` from `next-auth/jwt` — next-auth's own documented lower-level primitive for
exactly this case. `apps/web/tests/unit/proxy.spec.ts` is new: it constructs a real
`NextRequest` and calls the exported handler directly, asserting the CSP header and nonce
are present on `/sign-in`, that the redirect-to-sign-in behaviour for a protected route is
unchanged, and that public NextAuth API routes are not redirected — closing the exact test
gap this question named. Verified against a live `next dev` server too: `/sign-in` now
returns a `content-security-policy` header with a fresh nonce on every request, and the
protected-route redirect (`307` to `/sign-in?callbackUrl=...`) is unchanged.

Not independently re-verified against a real Keycloak-issued session (this sandbox's
`quay.io` block still stands) — the fix removes `next-auth`'s own internal short-circuit
entirely, so it does not depend on Keycloak being reachable to be correct, but a real
authenticated request through Keycloak is still the strongest possible confirmation and
has not been done.

### OQ-024 — `branch` step conditions cannot see a prior step's actual output · resolved 2026-09-01

**Question.** `RunnerOptions.evaluateCondition` only ever received `run.input` — the run's
static starting payload — never what an intervening agent actually produced, even though
every `branch` step built so far is narrated in its own pipeline file as reading one
specific prior step's output (e.g. `mod-02.ts`'s `branch-on-core-health`: "Condition
support.core_health_blocked evaluates AC-02's output.status === 'blocked'"). Wiring a real
per-condition evaluator against `run.input` alone would mean silently reading stale or
absent fields from the original request — `apps/worker/src/worker-host.ts` therefore left
`evaluateCondition` unwired entirely, so any run reaching a `branch` step failed loudly.

**Answer.** No migration and no new field on `BranchStep` are needed — the DAG already
says which step feeds a branch's condition; the runner just never looked. `dag.ts` gained
`findPredecessorStepId(pipeline, stepId)`: the one step whose forward edge (`next`, or a
branch's own `onTrue`/`onFalse`) points at `stepId`, throwing if more than one step does
(an ambiguous target is a pipeline authoring error, not something to guess between). Every
`branch` step across MOD-02, MOD-05 and LE has exactly one predecessor today.

`runner.ts`'s `resolveConditionInput` uses that to build a new `ConditionInput` —
`{ runInput, stepOutput }` — from data the runner already persists, no schema change:
`stepOutput` is the predecessor's own `SUCCEEDED` `OrchestratorStepRunRow.output`
(`listStepRuns` already reads this for retry/timeout bookkeeping elsewhere in the same
file), or an array of every item's output, in collection order, when the predecessor is a
`map` step (a map step has no output of its own — `branch-on-referral`'s predecessor,
`check-fidelity`, is one). `runInput` stays `run.input`, unchanged, because not every
condition can be answered from a predecessor's output alone: `branch-on-referral` needs
each monitored learner's SIAS status, which no step in its pipeline computes (see OQ-027,
below — that specific condition is still not resolved). `ConditionEvaluator`'s signature
changed from `(condition, input: unknown)` to `(condition, input: ConditionInput)` — a
breaking change with zero blast radius, since nothing implemented it before this fix.

`apps/worker/src/condition-evaluator.ts` is new: a real `evaluateCondition`, wired into
`worker-host.ts`'s `RunnerOptions` alongside `executeStep`/`prepareApproval`. It resolves
four of the five declared conditions for real, each against a field a ratified Zod schema
already fixes (`AC02Result.status`, `PD04Result.status`, `PD05Result`'s
`topPriorityGap.suggestedInterventionType`, `LE08Result.status`). Writing this surfaced a
separate, pre-existing defect: `le.ts`'s own comment said `learning.commons_publish_blocked`
checks `LE08Result.status === 'blocked'`, but `LE08Result` has no `'blocked'` literal at
all — its real statuses are `'published'`, `'suppressed_below_threshold'`,
`'suppressed_no_opt_in'` and `'needs_input'`. Fixed to `status !== 'published'` and the
stale comment corrected in the same commit.

Verified: `packages/orchestrator`'s full unit suite (189 tests, including new
`findPredecessorStepId` cases in `dag.spec.ts`) and `apps/worker`'s full unit suite (35
tests, including the new `condition-evaluator.spec.ts`) pass; the whole workspace's
`typecheck`/`lint`/`test` are clean. New integration coverage in
`runner.integration.spec.ts` (a branch reading its predecessor's real output, routing on
both outcomes, aggregating a map predecessor's item outputs in order, and the two error
paths — no `evaluateCondition` supplied, and a `branch` step with no predecessor) could not
be run in this authoring sandbox (no Docker daemon) — proven for real the same way every
other Testcontainers-backed suite in this package already is, by CI's own `database` job.

This blocked real branching in MOD-02 RTI, MOD-05 PD Analysis and LE Commons; all three are
now resolved. MOD-02 Monitoring's `branch-on-referral` is the one exception — see OQ-027.

### OQ-026 — `checkDiagnosticLanguage` has no caller · resolved 2026-09-01

**Question.** `checkDiagnosticLanguage` (`packages/guardrails/src/output-checks.ts`) is a
real, unit-tested guardrail with no caller anywhere in `apps/worker` or `apps/gateway` — it
needs to know which of a MOD-02 agent's own output fields are actual free text before it can
scan them, and guessing wrong risks both a missed diagnostic label and a false refusal on a
legitimate field. Two shapes were named: a field allow-list per agent contract, or a
dedicated post-processing step in the MOD-02 pipelines.

**Answer** (the human's own choice, asked via `AskUserQuestion` rather than picked
unilaterally, since this is a real architecture fork on a safety-relevant guardrail):
a field allow-list per agent contract.

`AgentContract` (`packages/agents/src/contract.ts`) gained an optional
`freeTextOutputFields: readonly string[]` — dot-separated paths (`"detail"`,
`"reportText"`, `"sections.content"`, `"decisions.nextSteps"`) naming an agent's own
free-text output fields, read by `@infinite-ai/guardrails`' new `extractFreeText`, which
walks a path and treats arrays transparently at any point along the way (an array of
section objects, or a field that is itself an array of strings, both resolve correctly).
Optional because most agents outside MOD-02 have no reason to declare it — a
`superRefine` on `AgentContract` makes it required and non-empty exactly when `guardrails`
declares `"diagnosis_guard"`, so a MOD-02 agent cannot claim the guardrail without naming
what it actually scans. This caught all 8 MOD-02 contracts that declare `"diagnosis_guard"`
(AC-01, AC-03, AC-04, AC-05, AC-06, AC-08, AC-09, AC-10) failing `validateAgentContract` the
moment the invariant was added — each now declares its real free-text fields, worked out
from its own ratified output schema (`@infinite-ai/analytics`'s `agent-schemas.ts`), not
guessed: e.g. AC-05's `['goal', 'strategy', 'detail']`, AC-09's `['sections.content',
'detail']`. AC-02 and AC-07 do not declare `"diagnosis_guard"` at all — correctly, since
neither agent's output carries any free text to scan.

`apps/worker/src/step-executor.ts`'s `runAgentCall` now checks
`contract.guardrails.includes('diagnosis_guard')` and, when true, extracts those fields
from the parsed output and calls `checkDiagnosticLanguage`, throwing the same
`GuardrailRefusalError` the age-appropriateness check already throws on refusal — no
injected checker needed here, unlike age-appropriateness/template-fidelity, since the term
list is a fixed vocabulary, not a policy this codebase would otherwise have to invent.

Verified: `packages/guardrails` (194 tests, including new `extractFreeText` coverage in
`diagnosis-redteam.spec.ts` — plain fields, array-of-strings fields, nested array-of-objects
paths, a path absent on one discriminated-union variant, and a diagnostic term buried in a
nested field still refused), `packages/agents` (460 tests, all 8 MOD-02 contracts now
passing `validateAgentContract` with real field lists), and `apps/worker` (38 tests,
including new `step-executor.spec.ts` coverage: clean output passes, a diagnostic term in a
declared field is refused, and a contract without `"diagnosis_guard"` is never scanned).
Full workspace `pnpm lint`/`typecheck`/`test`/`format:check` all green (51/51 packages).
