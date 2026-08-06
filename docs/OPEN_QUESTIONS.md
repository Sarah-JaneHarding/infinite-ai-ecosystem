# Open questions

Part 0 §0.3: stop work, write the question here, and ask, whenever a requirement conflicts
with another, a credential or source document is missing, an operation would be
irreversible, a control would have to be weakened, a CAPS / ATP / SIAS / SACE rule is
ambiguous, PII would be needed in a prompt, an exit gate cannot be met, or a stage would
overrun its budget by more than 30%.

**Never invent curriculum policy, assessment weightings, SIAS process steps or CPTD point
values.** If it is not in a supplied source document, it goes here.

| ID     | Raised     | Stage | Status             | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | ---------- | ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OQ-002 | 2026-07-28 | 08    | PARTIALLY ANSWERED | Scope confirmed 2026-07-29: full primary, Grades R-7, across all three phases. The documents themselves are still not supplied, so Stage 08 stays blocked. See `SOURCE_DOCUMENTS.md` for the intake checklist. The authoring environment cannot download them — direct HTTPS is refused by the sandbox network policy and the fetch tool 403s on every host — so a human must supply them. Note that `www.dbe.org.za` does not resolve; the DBE publishes at `www.education.gov.za`. |
| OQ-003 | 2026-07-28 | 08    | OPEN               | The school's own artefact templates (lesson plan, unit blueprint, assessment task, rubric, parent report) are needed before template-fidelity checking can be built, since fidelity is validated structurally against a machine-readable definition. Can the current templates be supplied?                                                                                                                                                                                          |
| OQ-004 | 2026-07-28 | 01    | OPEN               | Tenant shape for the seed data: the manual asks for a small primary, a large primary and a school group with two campuses. Should the seed model Benjamin Pine Primary specifically, or stay generic until a pilot tenant is confirmed?                                                                                                                                                                                                                                              |

| OQ-005 | 2026-07-29 | 08 | OPEN | CAPS statements, ATPs and DBE policy documents are Crown-copyright government publications. Redistributing them inside a multi-tenant SaaS product is a licensing question, not a technical one, and it is cheaper to settle before they are embedded in every tenant's L0. Options: rely on DBE terms for educational reuse; have each school supply its own copies; or store only derived structure (topic graphs, clause identifiers) rather than source text. |
| OQ-006 | 2026-07-29 | 12 | OPEN | SACE CPTD point-value schedules are needed for PD-08, which may not compute them. Same supply problem as OQ-002. Not yet on the critical path, but listed so it is not discovered late. |
| OQ-007 | 2026-07-29 | 03 | OPEN | **Retention periods per data category.** POPIA §14(1) forbids keeping personal information longer than necessary "unless a law requires otherwise", and for a school that clause does most of the work — admission registers, attendance registers and mark schedules carry statutory periods set outside this system. `packages/contracts` ships the shape of a schedule and the arithmetic to evaluate it, and deliberately ships no periods; a test asserts it stays that way. Until a school ratifies rules, nothing is tombstoned automatically and every unscheduled category is reported on each retention run. **Three things are needed per category: how long, measured from which event, and on whose authority.** A ratification form is ready at `docs/RETENTION_SCHEDULE_TEMPLATE.md`, and `pnpm check:retention` validates a filled-in copy before it is loaded. Blocks the nightly retention job; blocks nothing already built. See `docs/POPIA.md` §5.1. |
| OQ-014 | 2026-08-05 | 06 | OPEN | **Safeguarding escalation needs a real paging integration.** Stage 06 step 6's guardrail engine (`packages/guardrails/src/engine.ts`) can attach an `EscalationRoute` to a refusal for a safeguarding concern, and the manual's own text requires that route to "page a named human immediately and never queue." This build has no credentialed third-party paging account (SMS, phone, PagerDuty or similar) to actually reach anyone, so `defaultEscalationNotifier` throws `GuardrailEscalationError` rather than silently pretending to have paged someone — a real integration is a required follow-up before any pipeline that can produce a safeguarding-relevant refusal goes live. Which service, and whose account, is a decision for a human to make. |
| OQ-015 | 2026-08-05 | 06 | OPEN | **Age-appropriateness needs a supplied content policy.** The same guardrail engine's `checkAgeAppropriateness` is a real mechanism with no built-in rule — this codebase has no ratified wordlist, classifier or content-suitability policy by grade, and inventing one would be exactly the kind of unsourced policy rule 0.3 already forbids for curriculum content. It defaults to passing every output until a real policy is supplied and wired in as an injected checker, the same gap OQ-003 already names for template-fidelity checking. |
| OQ-016 | 2026-08-06 | 07 | OPEN | **The LLM-as-judge scorer has no calibration data.** Stage 07 step 2's own text requires the judge to be "calibrated against at least 50 human-labelled cases, and re-calibrated whenever its own model changes" — this build has neither a labelled dataset nor a calibration workflow, and inventing either would be exactly the kind of unsourced process rule §0.3 forbids. `packages/evals/src/scorers.ts`'s `scoreLlmJudge` builds the mechanism (an injected `LlmJudge` function a real caller wires to an actual Model Gateway call) and stops there — it neither performs nor claims a calibrated judgement. Needs: 50+ human-labelled cases sourced per module, a calibration procedure, and a decision on which logical model the judge itself should call through the gateway. Blocks trusting `llm_judge` expectation results for real promotion decisions (step 4); blocks nothing already built. |

### Phase 4 — proposed extension (Stages 19-25), not in the original 18-stage manual

Surfaced by `INFINITEAI_TASK_LIST.md` (uploaded 2026-08-05), which proposes seven
additional stages after Stage 18 — a visual AI-workflow builder, a prompt workshop, a
system-instruction workshop, live classroom quizzes, a low-tech card-scanning assessment
mode, collaborative document annotation, and a dedicated learner app — to bring
INFINITE-AI to parity with tools like Kahoot, Plickers and Kami. None of OQ-008 through
OQ-013 block current work: the build is still in Stage 05, and Phase 4 does not start
before Stage 18 passes its exit gate. They are recorded now so they are decided
deliberately, not defaulted into, when that time comes.

| ID     | Raised     | Stage | Status | Question                                                                                                                                                                                                                                                                                                                                                              |
| ------ | ---------- | ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-008 | 2026-08-05 | 19    | OPEN   | Should the visual AI-workflow builder be its own package (`@infinite-ai/agent-builder`) or built inside `packages/agents`? A separate package is cleaner to maintain on its own timeline; integrating it avoids keeping workflow state in two places.                                                                                                                 |
| OQ-009 | 2026-08-05 | 22    | OPEN   | Should live classroom quiz games (Stage 22) be a standalone product area, or folded into MOD-04's teaching-and-learning toolkit (Stage 11)? Standalone gets more visibility and dedicated resourcing; folding it in fits the module structure already in place.                                                                                                       |
| OQ-010 | 2026-08-05 | 25    | OPEN   | Should the learner-facing app (Stage 25) be a separate PWA, or built into the same `apps/web` every other role uses? Separate gives better offline support and a lighter load on a low-end phone; integrated is one codebase with shared components.                                                                                                                  |
| OQ-011 | 2026-08-05 | 10/19 | OPEN   | Where should SIAS documentation and workflow live long-term — inside MOD-02 Support Analytics (Stage 10, where it is currently planned), or split into its own module for more room to grow independently?                                                                                                                                                            |
| OQ-012 | 2026-08-05 | 20/21 | OPEN   | Should the Master Prompt Builder (Stage 20) and System Prompt Builder (Stage 21) be one combined tool or two separate ones? Separate is clearer about what each does; combined is a simpler experience over shared infrastructure.                                                                                                                                    |
| OQ-013 | 2026-08-05 | 08    | OPEN   | Eight of South Africa's eleven official languages, and Grades 10-12 entirely, are still missing from the CAPS documents supplied so far (see OQ-002). Sepedi, Sesotho and Setswana would serve the largest remaining population. Prioritise sourcing these before Stage 08 is considered feature-complete, or launch with what's supplied and add the rest afterward? |

## Resolved

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
