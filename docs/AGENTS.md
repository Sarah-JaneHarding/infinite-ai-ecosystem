# Agents

Every agent in this system is built to the Part 3 standard. There are no "quick" agents.

## 1. The registry

An agent declares `id`, `version`, `module`, `purpose` (from the taxonomy), `inputSchema`,
`outputSchema`, `promptRef`, `model` (a logical name, never a concrete one), `tools`,
`guardrails`, `budget`, `evalSetRef`, `requiresApproval` and `writesToBrain`. An agent
that omits any field **fails to register**, and a registry that fails validation is a boot
failure, not a warning.

## 2. Adding an agent — the checklist

1. Contract in `packages/agents/src/<module>/<id>.contract.ts` with input and output Zod
   schemas.
2. Declare purpose, model, tools, guardrails, budget and `requiresApproval`.
3. Prompt at `packages/prompts/src/<id>/1.0.0.prompt.md`, using the mandated structure.
4. Eval set: ≥ 20 cases, including 5 adversarial and 3 `must_not_regress`.
5. Implement as a thin function — assemble context via the Brain API, call the gateway,
   validate output, return a typed result. No business logic in the prompt that belongs
   in code.
6. Register it. Boot must succeed.
7. Add it to a pipeline, with a human gate if it produces anything a learner or parent
   will see.
8. Run evals. Meet the target before merging.
9. Confirm every step is legible in the Run Inspector.
10. Document it here: ID, purpose, inputs, outputs, guardrails, budget, owner.

## 3. The agent roster

Fifty-five agents across five modules plus the Learning Engine. Each is documented here as
it is built; the table below is the plan, not a claim of completion.

### MOD-01 Curriculum Engine — Stage 08

| ID    | Agent                 | Output                                                                     |
| ----- | --------------------- | -------------------------------------------------------------------------- |
| CE-01 | CAPS Mapper           | Topic and skill graph with weightings and cognitive levels                 |
| CE-02 | ATP Sequencer         | Topics on the DBE week-by-week calendar, holidays and exam weeks respected |
| CE-03 | Term Planner          | Term plan per subject and grade, with the assessment calendar              |
| CE-04 | Unit Architect        | Backward-design blueprint: big ideas, success criteria, evidence           |
| CE-05 | Lesson Plan Generator | Daily plans in the school's exact template                                 |
| CE-06 | Assessment Designer   | Formal and informal tasks, controlled cognitive-demand spread              |
| CE-07 | Rubric Builder        | Rubrics and marking memos tied to the task and its CAPS codes              |
| CE-08 | Differentiation Agent | Tier-aware variants: support, on-level, extension                          |
| CE-09 | Coverage Auditor      | Drift between planned, taught and assessed                                 |

#### CE-01 — CAPS Mapper

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                    |
| Purpose         | `planning`                                                                                                |
| Input           | `CE01Input`: grade, subjects[], tenantId                                                                  |
| Output          | `FrameworkResult`: `{ status: "ok", framework: GradeFramework }` or `FrameworkNeedsInput`                 |
| Model           | `curriculum.map`                                                                                          |
| Guardrails      | `pii_guard`, `grounding_check`                                                                            |
| Budget          | 6 000 tokens · $0.08 per run                                                                              |
| Eval set        | `CE-01` (30 specification cases; all test `needs_input` until CAPS source documents are ratified into L0) |
| Approval gate   | None — output goes to L0 as a ratification candidate                                                      |
| Writes to Brain | Yes — the GradeFramework is versioned in L0                                                               |
| Prompt          | `packages/prompts/src/CE-01/1.0.0.prompt.md`                                                              |
| Contract        | `packages/agents/src/mod-01/CE-01.contract.ts`                                                            |

CE-01 is an **empty vessel** until CAPS subject statements are ratified into L0 (see
`docs/SOURCE_DOCUMENTS.md`). Until then, every call returns `needs_input` naming the
missing documents — that is the correct behaviour, not a bug.

#### CE-02 — ATP Sequencer

| Field           | Value                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                            |
| Purpose         | `planning`                                                                                        |
| Input           | `CE02Input`: grade, subjects[], academicYear, tenantId, schoolCalendar?                           |
| Output          | `ATPResult`: `{ status: "ok", schedule: ATPSchedule }` or `ATPNeedsInput`                         |
| Model           | `curriculum.sequence`                                                                             |
| Guardrails      | `pii_guard`, `grounding_check`                                                                    |
| Budget          | 8 000 tokens · $0.10 per run                                                                      |
| Eval set        | `CE-02` (30 specification cases; all test `needs_input` until ATP documents are ratified into L0) |
| Approval gate   | None — ATP schedules are ratified at the term plan level (CE-03)                                  |
| Writes to Brain | Yes — the ATPSchedule is versioned in L0                                                          |
| Prompt          | `packages/prompts/src/CE-02/1.0.0.prompt.md`                                                      |
| Contract        | `packages/agents/src/mod-01/CE-02.contract.ts`                                                    |

CE-02 depends on CE-01's stored `GradeFramework` (retrieved from L0 by the executor) and
on a ratified ATP source document in L0. When either is absent, it returns `needs_input`.
ATP pacing is authoritative: any deviation from the ATP's own week-by-week position
requires a stored `deviationReason`, which CE-09 Coverage Auditor surfaces as drift.

#### CE-03 — Term Planner

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                  |
| Purpose         | `planning`                                                                                              |
| Input           | `CE03Input`: grade, subjects[], termNumber, academicYear, tenantId                                      |
| Output          | `TermPlanResult`: `{ status: "ok", plan: TermPlan }` or `TermPlanNeedsInput`                            |
| Model           | `curriculum.plan`                                                                                       |
| Guardrails      | `pii_guard`, `grounding_check`                                                                          |
| Budget          | 8 000 tokens · $0.10 per run                                                                            |
| Eval set        | `CE-03` (30 specification cases; all test `needs_input` until GradeFramework and ATPSchedule are in L0) |
| Approval gate   | None — term plans become ratification candidates in L0; the HoD gate is at the publish step             |
| Writes to Brain | Yes — the TermPlan is versioned in L0                                                                   |
| Prompt          | `packages/prompts/src/CE-03/1.0.0.prompt.md`                                                            |
| Contract        | `packages/agents/src/mod-01/CE-03.contract.ts`                                                          |

CE-03 translates an ATPSchedule into a per-term, per-subject plan: which content areas run
in which teaching weeks, and when assessment tasks fall. All placements must cite their ATP
source. Until the GradeFramework (CE-01), ATPSchedule (CE-02), and AssessmentPolicy are
ratified into L0, CE-03 returns `needs_input` naming every absent document.

#### CE-04 — Unit Architect

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                               |
| Purpose         | `planning`                                                                                           |
| Input           | `CE04Input`: grade, subject, termNumber, contentArea, academicYear, tenantId                         |
| Output          | `UnitBlueprintResult`: `{ status: "ok", blueprint: UnitBlueprint }` or `UnitNeedsInput`              |
| Model           | `curriculum.design`                                                                                  |
| Guardrails      | `pii_guard`, `grounding_check`                                                                       |
| Budget          | 10 000 tokens · $0.12 per run                                                                        |
| Eval set        | `CE-04` (30 specification cases; all test `needs_input` until GradeFramework and TermPlan are in L0) |
| Approval gate   | None — blueprints are ratification candidates; the HoD gate is at the lesson plan step               |
| Writes to Brain | Yes — the UnitBlueprint is versioned in L0                                                           |
| Prompt          | `packages/prompts/src/CE-04/1.0.0.prompt.md`                                                         |
| Contract        | `packages/agents/src/mod-01/CE-04.contract.ts`                                                       |

CE-04 takes a content area from the term plan and produces a backward-design unit blueprint:
big ideas (each `Sourced<string>`), success criteria with cognitive levels, and evidence
items classified as formal or informal. All values cite a CAPS clause; the agent may not
invent curriculum targets. Depends on CE-01's GradeFramework and CE-03's TermPlan.

#### CE-05 — Lesson Plan Generator

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                              |
| Purpose         | `planning`                                                                                                          |
| Input           | `CE05Input`: grade, subject, weekNumber, termNumber, academicYear, tenantId, templateId                             |
| Output          | `LessonPlanResult`: `{ status: "ok", plan: LessonPlan }` or `LessonPlanNeedsInput`                                  |
| Model           | `curriculum.lessons`                                                                                                |
| Guardrails      | `pii_guard`, `grounding_check`, `template_fidelity`                                                                 |
| Budget          | 12 000 tokens · $0.15 per run                                                                                       |
| Eval set        | `CE-05` (30 specification cases; all test `needs_input` until GradeFramework, UnitBlueprint and template are in L0) |
| Approval gate   | **Yes** — lesson plans reach teachers and learners; HoD must sign off before publish                                |
| Writes to Brain | Yes — the LessonPlan is versioned in L0                                                                             |
| Prompt          | `packages/prompts/src/CE-05/1.0.0.prompt.md`                                                                        |
| Contract        | `packages/agents/src/mod-01/CE-05.contract.ts`                                                                      |

CE-05 fills the school's approved lesson template from the unit blueprint CE-04 produced.
The `template_fidelity` guardrail verifies that the output conforms structurally to the
school's template before it leaves the agent. Because lesson plans are distributed to
teachers and may reach learners, this agent is the first in the CE chain that requires an
explicit HoD approval record before its output is published. Depends on CE-04's
UnitBlueprint and a ratified TemplateDefinition.

#### CE-06 — Assessment Designer

| Field           | Value                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                                 |
| Purpose         | `planning`                                                                                                             |
| Input           | `CE06Input`: grade, subject, termNumber, taskKind, academicYear, tenantId                                              |
| Output          | `AssessmentTaskDesignResult`: `{ status: "ok", task: AssessmentTaskDesign }` or `AssessmentDesignNeedsInput`           |
| Model           | `curriculum.assess`                                                                                                    |
| Guardrails      | `pii_guard`, `grounding_check`                                                                                         |
| Budget          | 10 000 tokens · $0.12 per run                                                                                          |
| Eval set        | `CE-06` (30 specification cases; all test `needs_input` until GradeFramework, TermPlan and AssessmentPolicy are in L0) |
| Approval gate   | **Yes** — formal assessment tasks directly affect learner records; HoD must sign off                                   |
| Writes to Brain | Yes — the AssessmentTaskDesign is versioned in L0                                                                      |
| Prompt          | `packages/prompts/src/CE-06/1.0.0.prompt.md`                                                                           |
| Contract        | `packages/agents/src/mod-01/CE-06.contract.ts`                                                                         |

CE-06 designs a formal or informal assessment task — test, assignment, project, oral,
practical, or examination — with a controlled spread across Bloom's cognitive levels. All
mark allocations come from the assessment policy in L0; the agent may not compute or invent
them. The `CognitiveLevelSpread` schema enforces that the six levels sum to exactly 100%
before the output is accepted. Depends on CE-01's GradeFramework, CE-03's TermPlan, and a
ratified AssessmentPolicy.

#### CE-07 — Rubric Builder

| Field           | Value                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                           |
| Purpose         | `planning`                                                                                                       |
| Input           | `CE07Input`: grade, subject, taskKind, tenantId, totalMarks                                                      |
| Output          | `RubricResult`: `{ status: "ok", rubric: Rubric }` or `RubricNeedsInput`                                         |
| Model           | `curriculum.rubric`                                                                                              |
| Guardrails      | `pii_guard`, `grounding_check`                                                                                   |
| Budget          | 8 000 tokens · $0.10 per run                                                                                     |
| Eval set        | `CE-07` (30 specification cases; all test `needs_input` until GradeFramework and AssessmentTaskDesign are in L0) |
| Approval gate   | None — the upstream assessment task was approved by CE-06's gate; the rubric is a marking tool                   |
| Writes to Brain | Yes — the Rubric is versioned in L0                                                                              |
| Prompt          | `packages/prompts/src/CE-07/1.0.0.prompt.md`                                                                     |
| Contract        | `packages/agents/src/mod-01/CE-07.contract.ts`                                                                   |

CE-07 takes the assessment task design CE-06 produced and generates a four-level rubric
(levels 1–4 with descriptors at each level) and a marking memo markers can use directly.
Each `RubricCriterion` carries its own source reference. No separate HoD approval gate
sits before the rubric: the task it annotates was already approved. Depends on CE-01's
GradeFramework and CE-06's AssessmentTaskDesign.

#### CE-08 — Differentiation Agent

| Field           | Value                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Module          | MOD-01                                                                                                 |
| Purpose         | `planning`                                                                                             |
| Input           | `CE08Input`: grade, subject, weekNumber, termNumber, academicYear, tenantId, tiers[]                   |
| Output          | `DifferentiationResult`: `{ status: "ok", set: DifferentiatedSet }` or `DifferentiationNeedsInput`     |
| Model           | `curriculum.differentiate`                                                                             |
| Guardrails      | `pii_guard`, `grounding_check`                                                                         |
| Budget          | 10 000 tokens · $0.12 per run                                                                          |
| Eval set        | `CE-08` (30 specification cases; all test `needs_input` until GradeFramework and LessonPlan are in L0) |
| Approval gate   | None — the upstream lesson plan was approved by CE-05's gate; tiers are a curriculum derivative        |
| Writes to Brain | Yes — the DifferentiatedSet is versioned in L0                                                         |
| Prompt          | `packages/prompts/src/CE-08/1.0.0.prompt.md`                                                           |
| Contract        | `packages/agents/src/mod-01/CE-08.contract.ts`                                                         |

CE-08 takes a lesson plan and produces tier-aware variants for support, on-level, and
extension learners. The caller specifies which tiers are needed; the agent produces only
those requested. Modifications and scaffolds per tier must cite CAPS objectives from the
lesson plan's source documents. CE-08 does not hold learner data — it writes curriculum
variants — so the approval gate is upstream at CE-05. Depends on CE-01's GradeFramework
and CE-05's LessonPlan.

#### CE-09 — Coverage Auditor

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Module          | MOD-01                                                                                                    |
| Purpose         | `planning`                                                                                                |
| Input           | `CE09Input`: grade, subject, termNumber, academicYear, tenantId                                           |
| Output          | `CoverageAuditResult`: `{ status: "ok", audit: CoverageAudit }` or `CoverageAuditNeedsInput`              |
| Model           | `curriculum.audit`                                                                                        |
| Guardrails      | `pii_guard`, `grounding_check`                                                                            |
| Budget          | 8 000 tokens · $0.10 per run                                                                              |
| Eval set        | `CE-09` (30 specification cases; all test `needs_input` until ratified TermPlan and L2 episode log exist) |
| Approval gate   | None — audit output is a diagnostic artefact; the HoD gate sits upstream at the publish step              |
| Writes to Brain | Yes — coverage audit records are versioned curriculum diagnostics                                         |
| Prompt          | `packages/prompts/src/CE-09/1.0.0.prompt.md`                                                              |
| Contract        | `packages/agents/src/mod-01/CE-09.contract.ts`                                                            |

CE-09 compares the ratified term plan (CE-03 output) against L2 episode records and
assessment records. It produces a drift report with four kinds of `DriftItem`: topics
planned but not taught, topics taught but not planned, topics planned but not assessed,
and assessments recorded for topics outside the plan. `coverageRatePct` is the percentage
of planned topics found in both the episode log and an assessment record. CE-09 has no
learner-data access — `driftItems` and `coverageRatePct` are curriculum diagnostics only.
The agent returns `needs_input` when the term plan is absent or unratified, or when no L2
episode log exists for the term. Runs after the HoD-approved `publish-to-brain` step in
the MOD-01 pipeline. Depends on CE-03's ratified `TermPlan` and the Brain's L2 procedural
memory.

### MOD-02 Support Analytics Centre — Stage 10

| ID    | Agent                | Output                                                              |
| ----- | -------------------- | ------------------------------------------------------------------- |
| AC-01 | Universal Screener   | Termly screen: literacy, numeracy, attendance, behaviour, wellbeing |
| AC-02 | Core-Health Analyst  | Is Tier 1 sufficient for ≥ 80%? Blocks mass referral when not       |
| AC-03 | Tier Recommender     | Proposed tier with the evidence that justified it                   |
| AC-04 | Early Warning Agent  | Daily risk signals                                                  |
| AC-05 | Intervention Planner | Goal, strategy, dosage, duration, owner                             |
| AC-06 | Progress Monitor     | Trend line against goal line; continue / intensify / exit           |
| AC-07 | Fidelity Checker     | Did the intervention run as planned                                 |
| AC-08 | SBST Meeting Scribe  | Agenda, minutes, decisions, next steps                              |
| AC-09 | SIAS Compiler        | Support-needs documentation pack for referral                       |
| AC-10 | Parent Report Writer | Plain-language progress letters in the family's home language       |

**AC-02 gates AC-03.** If core health fails for a class, tier recommendations for that
class are suppressed and a Tier 1 improvement task is raised instead.

#### AC-01 — Universal Screener

| Field           | Value                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                           |
| Purpose         | `intervention`                                                                                                                                                   |
| Input           | `AC01Input`: tenantId, learnerId (UUID), termId, domainReadings[]                                                                                                |
| Output          | `AC01Result`: `{ status: "ok", screenId, learnerId, termId, compositePercentile, tier, domainSufficiency, overallSufficiency }` · `needs_input` · `safeguarding` |
| Model           | `support.screen`                                                                                                                                                 |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                   |
| Budget          | 1 500 tokens · $0.005 per run                                                                                                                                    |
| Eval set        | `AC-01` (21 cases covering all tier bands, domain-sufficiency failures, safeguarding escalation)                                                                 |
| Approval gate   | None — screen output feeds the automated AC-02 gate                                                                                                              |
| Writes to Brain | Yes — screen results are versioned support facts                                                                                                                 |
| Prompt          | `packages/prompts/src/AC-01/1.0.0.prompt.md`                                                                                                                     |
| Contract        | `packages/agents/src/mod-02/AC-01.contract.ts`                                                                                                                   |

AC-01 receives domain-level percentile readings for one learner across five SIAS domains
(LITERACY, NUMERACY, ATTENDANCE, BEHAVIOUR, WELLBEING). It checks data sufficiency for
each domain, computes the composite percentile as the arithmetic mean, and assigns a
preliminary support tier. A safeguarding signal in the input metadata takes precedence
over all other output paths. No clinical, diagnostic, or disability language may appear
in the output; `tier` is the only classification. `learnerId` is an opaque UUID and must
not be echoed in any output field.

#### AC-02 — Core-Health Analyst

| Field           | Value                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                                     |
| Purpose         | `intervention`                                                                                                                                                             |
| Input           | `AC02Input`: tenantId, classId, termId, screenResults[] (learnerId + tier per learner)                                                                                     |
| Output          | `AC02Result`: `{ status: "healthy", tier1Percentage, learnerCount, tier1Count, gatesAc03: true }` · `{ status: "blocked", ..., gatesAc03: false, detail }` · `needs_input` |
| Model           | `support.health`                                                                                                                                                           |
| Guardrails      | `pii_guard`                                                                                                                                                                |
| Budget          | 800 tokens · $0.002 per run                                                                                                                                                |
| Eval set        | `AC-02` (21 cases covering all threshold boundaries, empty input, single-learner edge cases)                                                                               |
| Approval gate   | None — core-health assessment is an automated gate                                                                                                                         |
| Writes to Brain | No — AC-02 produces a gate signal, not a versioned fact                                                                                                                    |
| Prompt          | `packages/prompts/src/AC-02/1.0.0.prompt.md`                                                                                                                               |
| Contract        | `packages/agents/src/mod-02/AC-02.contract.ts`                                                                                                                             |

AC-02 receives all AC-01 screen results for a class and determines whether at least 80%
of learners are in TIER_1 (the DBE SIAS core-health threshold). If the class passes,
`gatesAc03: true` permits the Tier Recommender (AC-03) to run for individual learners.
If the class fails, `gatesAc03: false` suppresses individual tier recommendations and a
Tier 1 improvement task must be raised. AC-02 works at class level only; it never
identifies individual learners. `tier1Percentage` is rounded to two decimal places.

#### AC-03 — Tier Recommender

| Field           | Value                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                                        |
| Purpose         | `intervention`                                                                                                                                                                |
| Input           | `AC03Input`: tenantId, learnerId, classId, termId, screenId, compositePercentile, tier, domainSufficiency, `coreHealthGate: true` (literal), classHealthRecordId              |
| Output          | `AC03Result`: `{ status: "recommended", recommendationId, learnerId, termId, tier, compositePercentile, evidenceIds[], rationale, requiresSbstReview: true }` · `needs_input` |
| Model           | `support.screen`                                                                                                                                                              |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                                |
| Budget          | 1 200 tokens · $0.004 per run                                                                                                                                                 |
| Eval set        | `AC-03` (21 cases covering all tier bands, coreHealthGate enforcement, evidence linkage, SBST-review flag)                                                                    |
| Approval gate   | None — recommendation feeds the SBST human gate downstream                                                                                                                    |
| Writes to Brain | Yes — tier recommendation is a versioned support fact                                                                                                                         |
| Prompt          | `packages/prompts/src/AC-03/1.0.0.prompt.md`                                                                                                                                  |
| Contract        | `packages/agents/src/mod-02/AC-03.contract.ts`                                                                                                                                |

AC-03 proposes a support tier for one learner, given the screen output from AC-01 and the
green `coreHealthGate` signal from AC-02. The input schema enforces `coreHealthGate:
z.literal(true)` so the contract cannot be satisfied without a passing gate. Every output
must carry `evidenceIds` that include at minimum the `screenId` and `classHealthRecordId`
passed in — the agent may never invent or omit these. `requiresSbstReview` is always
`true`; a human SBST gate fires before the recommendation is acted upon. No diagnostic or
disability language may appear; `tier` is the only classification signal.

#### AC-04 — Early Warning Agent

| Field           | Value                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                     |
| Purpose         | `intervention`                                                                                                                                             |
| Input           | `AC04Input`: tenantId, learnerId, classId, termId, recentReadings[] (domain, percentileScore, ageInDays, evidenceId), previousScreenCompositePercentile?   |
| Output          | `AC04Result`: `{ status: "signals_found", warningId, learnerId, riskLevel, signals[], recommendFullScreen, evidenceIds[] }` · `no_signals` · `needs_input` |
| Model           | `support.screen`                                                                                                                                           |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                             |
| Budget          | 800 tokens · $0.002 per run                                                                                                                                |
| Eval set        | `AC-04` (20 cases covering HIGH/MEDIUM/LOW risk, no_signals, empty readings, recommendFullScreen threshold)                                                |
| Approval gate   | None — warning signals feed the monitoring queue automatically                                                                                             |
| Writes to Brain | No — warning signals are transient alerts, not versioned facts                                                                                             |
| Prompt          | `packages/prompts/src/AC-04/1.0.0.prompt.md`                                                                                                               |
| Contract        | `packages/agents/src/mod-02/AC-04.contract.ts`                                                                                                             |

AC-04 runs daily against recent domain readings and emits risk signals without waiting for
a full termly screen. Risk classification: HIGH if any domain ≤ 25th percentile and
declining; MEDIUM if any domain ≤ 35th percentile or composite dropped > 10 points;
LOW if any domain is declining but thresholds not yet met. `recommendFullScreen: true`
when any domain is ≤ 25th percentile or composite dropped > 15 points. Every signal
carries the `evidenceId` of the reading that triggered it. No diagnostic language; risk
level is the only classification.

#### AC-05 — Intervention Planner

| Field           | Value                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module          | MOD-02                                                                                                                                                                   |
| Purpose         | `intervention`                                                                                                                                                           |
| Input           | `AC05Input`: tenantId, learnerId, termId, tier (TIER_2 or TIER_3), targetDomains[], compositePercentile, sbstRatificationId (UUID), evidenceIds[]                        |
| Output          | `AC05Result`: `{ status: "planned", planId, learnerId, termId, tier, targetDomains[], goal, strategy, dosage, durationWeeks, ownerRole, evidenceIds[] }` · `needs_input` |
| Model           | `support.screen`                                                                                                                                                         |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                           |
| Budget          | 1 500 tokens · $0.005 per run                                                                                                                                            |
| Eval set        | `AC-05` (21 cases covering TIER_2/TIER_3 dosage, duration ranges, evidence linkage, missing sbstRatificationId)                                                          |
| Approval gate   | None — plan output feeds the SBST human ratification gate                                                                                                                |
| Writes to Brain | Yes — intervention plan is a versioned support fact                                                                                                                      |
| Prompt          | `packages/prompts/src/AC-05/1.0.0.prompt.md`                                                                                                                             |
| Contract        | `packages/agents/src/mod-02/AC-05.contract.ts`                                                                                                                           |

AC-05 requires proof of the SBST human gate via `sbstRatificationId` — a missing or
malformed UUID returns `needs_input`. TIER_2 dosage: 2–3 sessions/week, 20–30 min each,
6–10 weeks. TIER_3 dosage: 4–5 sessions/week, 30–45 min each, 10–16 weeks. `ownerRole`
is always a role name (e.g. "Learning Support Educator"), never a personal name. Output
`evidenceIds` must carry through all input `evidenceIds`. No diagnostic language in the
`goal` or `strategy` fields.

#### AC-06 — Progress Monitor

| Field           | Value                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module          | MOD-02                                                                                                                                                                                                       |
| Purpose         | `intervention`                                                                                                                                                                                               |
| Input           | `AC06Input`: tenantId, learnerId, termId, planId, measurements[] (≥ 2, measuredOn, domain, percentileScore, evidenceId), goalPercentile, weeksSinceIntervention                                              |
| Output          | `AC06Result`: `{ status: "monitored", monitorId, learnerId, termId, planId, trendDirection, currentPercentile, goalPercentile, progressRatePerWeek, recommendation, evidenceIds[], detail }` · `needs_input` |
| Model           | `support.screen`                                                                                                                                                                                             |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                                                               |
| Budget          | 1 000 tokens · $0.003 per run                                                                                                                                                                                |
| Eval set        | `AC-06` (21 cases covering all recommendation types, trend directions, boundary cases, evidence from all measurements)                                                                                       |
| Approval gate   | None — monitoring recommendation feeds the educator dashboard                                                                                                                                                |
| Writes to Brain | No — progress snapshot is transient; the plan is the versioned fact                                                                                                                                          |
| Prompt          | `packages/prompts/src/AC-06/1.0.0.prompt.md`                                                                                                                                                                 |
| Contract        | `packages/agents/src/mod-02/AC-06.contract.ts`                                                                                                                                                               |

AC-06 requires at least two measurements to compute a trend. Recommendation priority (in
order): **exit** if trend is improving AND current percentile ≥ goal; **intensify** if
trend is declining for ≥ 4 consecutive weeks OR stable for ≥ 8 weeks below goal;
**continue** otherwise. `progressRatePerWeek` is negative on a declining trend.
`evidenceIds` must include the `evidenceId` from every measurement supplied.

#### AC-07 — Fidelity Checker

| Field           | Value                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                                                                                 |
| Purpose         | `intervention`                                                                                                                                                                                                         |
| Input           | `AC07Input`: tenantId, learnerId, termId, planId, plannedSessions[] (scheduledOn, domain, plannedMinutes), deliveredSessions[] (deliveredOn, domain, deliveredMinutes, deliveredByRole, evidenceId), planEvidenceIds[] |
| Output          | `AC07Result`: `{ status: "adequate" \| "inadequate", fidelityId, learnerId, termId, planId, plannedSessionCount, deliveredSessionCount, fidelityRate, evidenceIds[], detail }` · `needs_input`                         |
| Model           | `support.screen`                                                                                                                                                                                                       |
| Guardrails      | `pii_guard`                                                                                                                                                                                                            |
| Budget          | 800 tokens · $0.002 per run                                                                                                                                                                                            |
| Eval set        | `AC-07` (21 cases covering adequate/inadequate verdicts, 80% minute threshold, zero delivery, empty planned, fidelityRate precision)                                                                                   |
| Approval gate   | None — fidelity report feeds the educator dashboard                                                                                                                                                                    |
| Writes to Brain | No — fidelity snapshot is a transient report                                                                                                                                                                           |
| Prompt          | `packages/prompts/src/AC-07/1.0.0.prompt.md`                                                                                                                                                                           |
| Contract        | `packages/agents/src/mod-02/AC-07.contract.ts`                                                                                                                                                                         |

AC-07 computes `fidelityRate = (deliveredSessionCount / plannedSessionCount) × 100`,
rounded to two decimal places. A session is counted as delivered only if
`deliveredMinutes ≥ 0.8 × plannedMinutes` AND the `deliveredOn` date is the same or
next calendar day as `scheduledOn`. Adequate = fidelityRate ≥ 80%. `evidenceIds` must
include all `planEvidenceIds` plus the `evidenceId` from every delivered session.
No diagnostic language; fidelity metrics are the only outputs.

#### AC-08 — SBST Meeting Scribe

| Field           | Value                                                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                                                                                                       |
| Purpose         | `intervention`                                                                                                                                                                                                                               |
| Input           | `AC08Input`: tenantId, meetingId, termId, scheduledOn, participantRoles[] (≥ 1), agendaItems[] (≥ 1, each with learnerId, siasStatus, recommendedDecision, contextSummary, evidenceIds[])                                                    |
| Output          | `AC08Result`: `{ status: "scribed", minutesId, termId, scheduledOn, participantRoles[], decisions[] (learnerId, decision, sbstRatificationId, nextSteps[]), actionItems[], evidenceIds[], requiresChairConfirmation: true }` · `needs_input` |
| Model           | `support.screen`                                                                                                                                                                                                                             |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                                                                                               |
| Budget          | 2 000 tokens · $0.006 per run                                                                                                                                                                                                                |
| Eval set        | `AC-08` (21 cases covering all four decision types, multi-learner meetings, evidence ID union, needs_input paths, no diagnostic language, no person names)                                                                                   |
| Approval gate   | Chair confirmation required — `requiresChairConfirmation` is always `true`                                                                                                                                                                   |
| Writes to Brain | Yes — ratified minutes are a versioned support fact                                                                                                                                                                                          |
| Prompt          | `packages/prompts/src/AC-08/1.0.0.prompt.md`                                                                                                                                                                                                 |
| Contract        | `packages/agents/src/mod-02/AC-08.contract.ts`                                                                                                                                                                                               |

AC-08 converts a structured meeting agenda into ratified minutes. Decision types are
`ratify_intervention`, `ratify_exit`, `ratify_referral`, and `defer`. A `defer` decision
produces `sbstRatificationId: null`; every non-defer decision produces a freshly generated
UUID. `nextSteps` are always framed by role (e.g., "Learning Support Educator to…"), never
by personal name. `evidenceIds` in the output is the union of all `evidenceIds` across
every agenda item. `requiresChairConfirmation` is always `true` — no code path may omit it.

#### AC-09 — SIAS Compiler

| Field           | Value                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Module          | MOD-02                                                                                                                                                                                                                                     |
| Purpose         | `intervention`                                                                                                                                                                                                                             |
| Input           | `AC09Input`: tenantId, learnerId, termId, siasStatus (must be `"REFERRAL_PENDING"`), sbstRatificationId, screenHistory[], interventionHistory[], progressSummary, evidenceIds[]                                                            |
| Output          | `AC09Result`: `{ status: "compiled", compilationId, learnerId, termId, sbstRatificationId, sections[] (≥ 1), evidenceIds[], requiresSignOff: true }` · `{ status: "state_machine_blocked", detail }` · `{ status: "needs_input", detail }` |
| Model           | `support.screen`                                                                                                                                                                                                                           |
| Guardrails      | `pii_guard`, `diagnosis_guard`                                                                                                                                                                                                             |
| Budget          | 2 500 tokens · $0.008 per run                                                                                                                                                                                                              |
| Eval set        | `AC-09` (21 cases covering REFERRAL_PENDING success, seven blocked states, section order, no diagnostic language, evidence ID pass-through, sbstRatificationId echoed)                                                                     |
| Approval gate   | Sign-off required — `requiresSignOff` is always `true`                                                                                                                                                                                     |
| Writes to Brain | Yes — compiled referral pack is a versioned support fact                                                                                                                                                                                   |
| Prompt          | `packages/prompts/src/AC-09/1.0.0.prompt.md`                                                                                                                                                                                               |
| Contract        | `packages/agents/src/mod-02/AC-09.contract.ts`                                                                                                                                                                                             |

AC-09 is a SIAS state-machine enforcement point: it accepts input only when
`siasStatus === 'REFERRAL_PENDING'`; any other status yields `state_machine_blocked`. The
compiled pack contains exactly five sections in order: (1) Learner Support History,
(2) Intervention Record, (3) Progress Summary, (4) Referral Basis, (5) SBST Ratification.
The SBST Ratification section must cite the `sbstRatificationId` from input.
`requiresSignOff` is always `true`. Evidence IDs pass through unchanged.

#### AC-10 — Parent Report Writer

| Field           | Value                                                                                                                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module          | MOD-02                                                                                                                                                                                                                                                |
| Purpose         | `intervention`                                                                                                                                                                                                                                        |
| Input           | `AC10Input`: tenantId, learnerId, termId, planId, sbstRatificationId, homeLanguage (SA ISO 639 code), targetReadabilityGrade (1–12), progressSummary (trendDirection, currentPercentile, goalPercentile, recommendation, weeksElapsed), evidenceIds[] |
| Output          | `AC10Result`: `{ status: "written", reportId, learnerId, termId, homeLanguage, reportText, estimatedReadabilityGrade, readabilityAdequate, evidenceIds[] }` · `needs_input`                                                                           |
| Model           | `support.screen`                                                                                                                                                                                                                                      |
| Guardrails      | `pii_guard`, `diagnosis_guard`, `readability_guard`                                                                                                                                                                                                   |
| Budget          | 1 500 tokens · $0.005 per run                                                                                                                                                                                                                         |
| Eval set        | `AC-10` (21 cases covering all 11 SA language codes, all recommendation types, readability band checks, needs_input paths, no diagnostic language, no learner name, no raw percentiles to guardian)                                                   |
| Approval gate   | Human review required before letter is dispatched                                                                                                                                                                                                     |
| Writes to Brain | No — parent letters are dispatched deliverables, not versioned support facts                                                                                                                                                                          |
| Prompt          | `packages/prompts/src/AC-10/1.0.0.prompt.md`                                                                                                                                                                                                          |
| Contract        | `packages/agents/src/mod-02/AC-10.contract.ts`                                                                                                                                                                                                        |

AC-10 writes a plain-language progress letter for the guardian in the learner's home
language (`homeLanguage` is one of the 11 official SA ISO codes). The letter body must be
at or below `targetReadabilityGrade + 1` Flesch-Kincaid grade level.
`readabilityAdequate = estimatedReadabilityGrade ≤ targetReadabilityGrade + 1`. The letter
never uses diagnostic or clinical language, never names the learner, and never quotes raw
percentile scores — the trend is translated into everyday language. All evidence IDs pass
through unchanged.

### MOD-03 Data Collection & Warehouse — Stage 09

| ID    | Agent                   | Output                                                          |
| ----- | ----------------------- | --------------------------------------------------------------- |
| DW-01 | Ingestion Agent         | Scheduled and event pulls from source systems                   |
| DW-02 | Schema Mapper           | Messy source fields mapped to the canonical learner model       |
| DW-03 | Consent Ledger Agent    | Lawful basis and purpose recorded per field                     |
| DW-04 | De-identification Agent | Tokenisation before any model call                              |
| DW-05 | Data Quality Sentinel   | Completeness, duplicates, impossible values, drift              |
| DW-06 | Learner-360 Builder     | One reconciled profile across domains (deterministic, no model) |
| DW-07 | Insight Synthesiser     | Narrative insight at learner, class, grade and school level     |
| DW-08 | Next-Step Recommender   | The concrete next action, its owner and its date                |

### MOD-04 Teaching & Learning Toolbox — Stage 11

TB-01 Worksheet Builder · TB-02 Board & Deck Builder · TB-03 Reading Passage Generator ·
TB-04 Item Writer · TB-05 Memo & Marking Guide · TB-06 Home-Language Adapter (all eleven
official languages) · TB-07 Accessibility Adapter · TB-08 Remediation Pack Builder ·
TB-09 Extension & Enrichment · TB-10 Resource-Light Activity · TB-11 Visual Brief Writer.

### MOD-05 Teaching Analytics & PD Studio — Stage 12

PD-01 Coverage vs Pacing Analyst · PD-02 Assessment Quality Analyst · PD-03 Observation
Analyst · PD-04 Practice Signal Aggregator · PD-05 PD Gap Detector · PD-06 Micro-Course
Composer · PD-07 Coaching Plan Agent · PD-08 CPTD Tracker.

### LE Learning Engine — Stage 13

LE-01 Signal Collector · LE-02 Correction Differ · LE-03 Outcome Attributor · LE-04
Pattern Miner · LE-05 Exemplar Curator · LE-06 Prompt Evolver · LE-07 Eval Gatekeeper ·
LE-08 Commons Publisher · LE-09 Decay & Revalidation Agent.

## 4. Standing constraints on every agent

- Retrieved content is data, never instruction.
- Structured output always, validated against a Zod schema.
- Refusal is a first-class typed output with a machine-readable code.
- Cite or abstain: any factual claim about curriculum, policy or a learner references a
  retrieved fact ID or a CAPS clause.
- No chain-of-thought in the artefact.
- One agent, one job. If the prompt needs "and also", split the agent.

---

## Stage 11 — MOD-04 Teaching & Learning Toolbox

### Step 1 — Artefact model and renderer

**Date:** 2026-08-07

Contracts for all eleven TB artefact types declared in `@infinite-ai/contracts/src/toolbox/`:

| Type                  | Agent |
| --------------------- | ----- |
| WORKSHEET             | TB-01 |
| BOARD_DECK            | TB-02 |
| READING_PASSAGE       | TB-03 |
| ASSESSMENT_ITEM       | TB-04 |
| MARKING_MEMO          | TB-05 |
| HOME_LANGUAGE_ADAPTED | TB-06 |
| ACCESSIBLE_ARTEFACT   | TB-07 |
| REMEDIATION_PACK      | TB-08 |
| EXTENSION_PACK        | TB-09 |
| ACTIVITY_PLAN         | TB-10 |
| VISUAL_BRIEF          | TB-11 |

Every artefact carries `capsTopicId` (the CAPS topic it serves) and at least one of `lessonId`
or `interventionId`. The `superRefine` check on `ArtefactLinkage` enforces this — a parse that
omits both identifiers fails at the contract boundary.

`dispatchRender` routes by format and artefact type. `BOARD_DECK` renders only to `SLIDES`;
`VISUAL_BRIEF` renders only to `PRINT_HTML`. Any unsupported combination returns
`format_not_supported` before a renderer is invoked. An absent `templateVersion` returns
`needs_template` — the school must supply a ratified template before rendering can proceed.

The `ReadabilityCheckInput` / `ReadabilityCheckResult` contract declares what "measured
grade band" means. The `AnswerKeyVerificationResult` contract declares the TB-05 independent
verification gate: `disagreement` blocks release; `verified` allows it.

`VISUAL_BRIEF` extends the base artefact with a `brief` (text description) and a
`pedagogicalPurpose` field. No image data or generative image call is involved.

TB agent contracts, prompt files, and eval sets come in Stage 11 Step 2.

### Step 2 — TB-01 / TB-03 / TB-04 / TB-05 contracts, prompts, eval sets

**Date:** 2026-08-10

#### TB-01 — Worksheet Builder

| Field            | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| ID               | TB-01                                                         |
| Version          | 1.0.0                                                         |
| Module           | MOD-04                                                        |
| Purpose          | planning                                                      |
| Model            | plan.author                                                   |
| Guardrails       | pii_guard, source_grounding_guard                             |
| Budget           | 4 000 tokens / $0.02                                          |
| requiresApproval | false                                                         |
| writesToBrain    | false                                                         |
| Eval set         | `packages/evals/sets/TB-01/worksheet-builder.json` (21 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, subject,
learningObjectives (≥1), targetReadabilityBand, language, sourceDocumentIds (≥1), requestedBy,
differentiationTier? (SUPPORT | STANDARD | EXTENSION).

**Outputs (discriminated union on `status`):**

- `ok` — WORKSHEET artefact: sections (≥1 WorksheetSection each with ≥1 question),
  readabilityCheckResult, citedSourceIds ⊆ sourceDocumentIds, differentiationTier (nullable).
- `needs_input` — required field absent or unresolvable.
- `no_source_document` — sourceDocumentIds empty, absent, or insufficient for grounding.

All content must be grounded in cited documents. The agent refuses rather than fabricates.

#### TB-03 — Reading Passage Generator

| Field            | Value                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| ID               | TB-03                                                                 |
| Version          | 1.0.0                                                                 |
| Module           | MOD-04                                                                |
| Purpose          | planning                                                              |
| Model            | plan.author                                                           |
| Guardrails       | pii_guard, source_grounding_guard, readability_guard                  |
| Budget           | 3 000 tokens / $0.015                                                 |
| requiresApproval | false                                                                 |
| writesToBrain    | false                                                                 |
| Eval set         | `packages/evals/sets/TB-03/reading-passage-generator.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + linkage, gradeLabel, subject, topic, targetReadabilityBand,
wordCountTarget (int, positive), language, decodable (bool, default false), sourceDocumentIds (≥1),
requestedBy.

**Outputs:**

- `ok` — READING_PASSAGE artefact: title, body (word count ±10% of target), wordCount,
  readabilityCheckResult, isDecodable, citedSourceIds.
- `readability_out_of_band` — measuredGrade outside targetBand; passage is discarded rather than
  delivered with a warning.
- `needs_input` / `no_source_document` — same semantics as TB-01.

When `decodable: true`, the passage must use only letter-sound correspondences up to the learner's
current Foundation Phase decoding phase (no silent-letter or digraph words beyond the phase).

#### TB-04 — Item Writer

| Field            | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| ID               | TB-04                                                   |
| Version          | 1.0.0                                                   |
| Module           | MOD-04                                                  |
| Purpose          | planning                                                |
| Model            | plan.author                                             |
| Guardrails       | pii_guard, source_grounding_guard                       |
| Budget           | 3 500 tokens / $0.018                                   |
| requiresApproval | false                                                   |
| writesToBrain    | false                                                   |
| Eval set         | `packages/evals/sets/TB-04/item-writer.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + linkage, gradeLabel, subject, topic, cognitiveLevel (Bloom's
lowercase enum), itemType (multiple_choice | short_answer | extended_response | true_false), count
(1–20), targetReadabilityBand, language, sourceDocumentIds (≥1), requestedBy.

**Outputs:**

- `ok` — ASSESSMENT_ITEM artefact: items[] (AssessmentItem), totalMarks, readabilityCheckResult,
  citedSourceIds. Multiple-choice items carry exactly four MCOptions; no answer key in this output.
- `needs_input` / `no_source_document`.

The answer key for TB-04 items is produced exclusively by TB-05.

#### TB-05 — Memo & Marking Guide Agent

| Field            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| ID               | TB-05                                                          |
| Version          | 1.0.0                                                          |
| Module           | MOD-04                                                         |
| Purpose          | planning                                                       |
| Model            | plan.verify                                                    |
| Guardrails       | pii_guard                                                      |
| Budget           | 3 000 tokens / $0.015                                          |
| requiresApproval | **true** — marking memo release requires teacher approval gate |
| writesToBrain    | false                                                          |
| Eval set         | `packages/evals/sets/TB-05/memo-marking-guide.json` (21 cases) |

**Inputs:** tenantId, capsTopicId + linkage, gradeLabel, assessmentArtefactId (the TB-04 output
UUID), items[] (TB05ItemInput: itemId, questionText, itemType, options, marks), language,
requestedBy.

**Outputs:**

- `verified` — MARKING_MEMO artefact: answerKey[] (AnswerKeyEntry with modelAnswer,
  markingCriteria, correctOptionId?), verificationItems[] (TB05VerificationItem: authorAnswer,
  verifierAnswer, agrees: true for all), totalMarks. Released only when all items agree.
- `disagreement_flagged` — flaggedItems[] (items where agrees=false), allItems[] (complete
  set for audit), detail. Blocks release; teacher must adjudicate before any further action.
- `needs_input`.

The agent runs two independent passes internally (plan.author then plan.verify). A single item
where the verifier disagrees with the author triggers `disagreement_flagged`. The MARKING_MEMO
artefact is never delivered until the teacher adjudication gate (`requiresApproval: true`) clears.

### Step 3 — TB-06 Home-Language Adapter contract, prompt, eval sets

**Date:** 2026-08-10

#### TB-06 — Home-Language Adapter

| Field            | Value                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| ID               | TB-06                                                                                                    |
| Version          | 1.0.0                                                                                                    |
| Module           | MOD-04                                                                                                   |
| Purpose          | planning                                                                                                 |
| Model            | plan.author                                                                                              |
| Guardrails       | pii_guard                                                                                                |
| Budget           | 4 000 tokens / $0.02                                                                                     |
| requiresApproval | false                                                                                                    |
| writesToBrain    | false                                                                                                    |
| Eval set         | `packages/evals/sets/TB-06/{af,en,zu,xh,nso,st,tn,nr,ss,ve,ts}.json` (220 cases total — 20 per language) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, sourceArtefactId,
sourceArtefactType, content (min 1), sourceLanguage, targetLanguage, loltLanguage (all `OfficialLanguage`
— one of the 11 South African ISO codes: af, en, nr, xh, zu, nso, st, tn, ss, ve, ts), requestedBy.
Source and target language must differ.

**Outputs:**

- `ok` — HOME_LANGUAGE_ADAPTED artefact: adaptedContent, targetLanguage, requiresHumanReview
  (bool), reviewReason? (required when requiresHumanReview is true).
- `needs_input` — required field absent, linkage missing, or sourceLanguage === targetLanguage.
- `no_source_content` — content field absent or empty.

**Language quality tiers:** Tier 1 (af, en, zu, xh, tn, st, nso) — `requiresHumanReview: false`.
Tier 2 (nr, ss, ve, ts) — `requiresHumanReview: true` and `reviewReason` required; the pipeline
must not deliver Tier-2 output without a recorded human-review approval.

### Step 4 — TB-07 Accessibility Adapter contract, prompt, eval set

**Date:** 2026-08-11

#### TB-07 — Accessibility Adapter

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| ID               | TB-07                                            |
| Version          | 1.0.0                                            |
| Module           | MOD-04                                           |
| Purpose          | planning                                         |
| Model            | plan.author                                      |
| Guardrails       | pii_guard                                        |
| Budget           | 5 000 tokens / $0.025                            |
| requiresApproval | false                                            |
| writesToBrain    | false                                            |
| Eval set         | `packages/evals/sets/TB-07/main.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, sourceArtefactId,
sourceArtefactType, content (min 1), language (ISO code), accessibilityMode (`AccessibilityMode`
enum: LARGE_PRINT | DYSLEXIA_FRIENDLY | SIMPLIFIED_LANGUAGE | BRAILLE_READY), requestedBy.

**Outputs:**

- `ok` — ACCESSIBLE_ARTEFACT: adaptedContent, accessibilityMode, accessibilityCheckResult
  (verdict='pass', all named checks passing).
- `accessibility_check_failed` — accessibilityMode, accessibilityCheckResult (verdict='fail'),
  detail. Returned when best-effort adaptation cannot meet mode requirements.
- `needs_input` — linkage missing or required field absent.
- `no_source_content` — content field absent or empty.

**Named checks per mode:** LARGE_PRINT (font_size_spec, line_length, single_column, contrast);
DYSLEXIA_FRIENDLY (font_spec, line_spacing, line_length, left_align_only, no_italics);
SIMPLIFIED_LANGUAGE (avg_sentence_length, technical_terms_addressed, readability_within_band);
BRAILLE_READY (no_colour_only_references, no_image_only_content, linear_layout, math_linear_notation).
BRAILLE_READY requires `[TACTILE GRAPHIC REQUIRED: <description>]` flags for visual elements.

### Step 5 — TB-08 Remediation Pack Builder and TB-09 Extension & Enrichment Agent

**Date:** 2026-08-11

#### TB-08 — Remediation Pack Builder

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| ID               | TB-08                                            |
| Version          | 1.0.0                                            |
| Module           | MOD-04                                           |
| Purpose          | planning                                         |
| Model            | plan.author                                      |
| Guardrails       | pii_guard, source_grounding_guard                |
| Budget           | 4 000 tokens / $0.02                             |
| requiresApproval | false                                            |
| writesToBrain    | false                                            |
| Eval set         | `packages/evals/sets/TB-08/main.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, subject, topic,
missedSkills[] (≥1), targetReadabilityBand, language, sourceDocumentIds (≥1), requestedBy.

**Outputs:**

- `ok` — REMEDIATION_PACK artefact: sections[] (one `RemediationSection` per missed skill — each
  with explanation, workedExamples ≥2, practiceItems ≥3), readabilityCheckResult, citedSourceIds.
- `needs_input` — missedSkills absent or empty, or linkage missing.
- `no_source_document` — sourceDocumentIds empty or insufficient.

All explanations are plain-language re-teaching, not re-presentations of the original content.
Worked examples are annotated step-by-step; practice items are graduated in difficulty.

#### TB-09 — Extension & Enrichment Agent

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| ID               | TB-09                                            |
| Version          | 1.0.0                                            |
| Module           | MOD-04                                           |
| Purpose          | planning                                         |
| Model            | plan.author                                      |
| Guardrails       | pii_guard, source_grounding_guard                |
| Budget           | 4 000 tokens / $0.02                             |
| requiresApproval | false                                            |
| writesToBrain    | false                                            |
| Eval set         | `packages/evals/sets/TB-09/main.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, subject, topic,
masteredSkills[] (≥1), enrichmentFocus (`EnrichmentFocus` enum: DEEPER_EXPLORATION |
CHALLENGE_TASKS | CROSS_CURRICULAR | HIGHER_ORDER_THINKING), targetReadabilityBand, language,
sourceDocumentIds (≥1), requestedBy. Optional: connectingSubject (required when focus is
CROSS_CURRICULAR).

**Outputs:**

- `ok` — EXTENSION_PACK artefact: sections[] (`ExtensionSection[]` — title, enrichmentFocus,
  content, tasks[]), readabilityCheckResult, citedSourceIds.
- `needs_input` — masteredSkills absent or empty, or linkage missing.
- `no_source_document` — sourceDocumentIds empty or insufficient.

**Focus modes:** DEEPER_EXPLORATION — nuance, edge cases, the "why behind the rule";
CHALLENGE_TASKS — higher Bloom tier with less scaffolding; CROSS_CURRICULAR — explicitly named
connecting subject grounded in curriculum; HIGHER_ORDER_THINKING — synthesis, evaluation, and
creation at top Bloom tiers, framing for open-ended responses. Pack builds FROM mastery, not
re-teaching.

### Step 6 — TB-02 Board & Deck Builder and TB-10 Resource-Light Activity Agent

**Date:** 2026-08-11

#### TB-02 — Board & Deck Builder

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| ID               | TB-02                                            |
| Version          | 1.0.0                                            |
| Module           | MOD-04                                           |
| Purpose          | planning                                         |
| Model            | plan.author                                      |
| Guardrails       | pii_guard, source_grounding_guard                |
| Budget           | 4 000 tokens / $0.02                             |
| requiresApproval | false                                            |
| writesToBrain    | false                                            |
| Eval set         | `packages/evals/sets/TB-02/main.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, subject, topic,
learningObjectives[] (≥1), targetReadabilityBand, language, sourceDocumentIds (≥1), requestedBy,
presentationPurpose? (INTRODUCTION | LESSON | REVIEW | CONSOLIDATION), slideCount? (3–30 int).

**Outputs:**

- `ok` — BOARD_DECK artefact: slides[] (≥1 `Slide` — title, content, speakerNotes?),
  presentationPurpose (nullable), readabilityCheckResult, citedSourceIds ⊆ sourceDocumentIds.
- `needs_input` — linkage missing or required field absent.
- `no_source_document` — sourceDocumentIds empty or insufficient.

The BOARD_DECK artefact renders only to SLIDES format; no print or PDF render is supported.
All slide content must be grounded in cited documents; the agent refuses rather than fabricates.
Decks go to teacher review before delivery (`requiresApproval: false` — review is a pipeline
concern, not a contract-level gate for this agent).

#### TB-10 — Resource-Light Activity Agent

| Field            | Value                                            |
| ---------------- | ------------------------------------------------ |
| ID               | TB-10                                            |
| Version          | 1.0.0                                            |
| Module           | MOD-04                                           |
| Purpose          | planning                                         |
| Model            | plan.author                                      |
| Guardrails       | pii_guard, source_grounding_guard                |
| Budget           | 4 000 tokens / $0.02                             |
| requiresApproval | false                                            |
| writesToBrain    | false                                            |
| Eval set         | `packages/evals/sets/TB-10/main.json` (20 cases) |

**Inputs:** tenantId, capsTopicId + (lessonId | interventionId), gradeLabel, subject, topic,
learningObjectives[] (≥1), activityDurationMinutes (int, positive), targetReadabilityBand, language,
sourceDocumentIds (≥1), requestedBy, resourceConstraints[]? (`ResourceConstraint` enum:
NO_PRINTING | NO_DEVICES | NO_ELECTRICITY | ORAL_ONLY).

**Outputs:**

- `ok` — ACTIVITY_PLAN artefact: activityTitle, overview, materials[], steps[] (≥1 `ActivityStep`
  — instruction + optional durationMinutes), adaptations[] (differentiation strategies),
  readabilityCheckResult, citedSourceIds ⊆ sourceDocumentIds.
- `needs_input` — linkage missing, activityDurationMinutes ≤ 0, or required field absent.
- `no_source_document` — sourceDocumentIds empty or insufficient.

**Constraint semantics (stacking):** NO_PRINTING — no handouts, worksheets, or printed items;
NO_DEVICES — no tablets, computers, smartboards, or electronic tools; NO_ELECTRICITY — no powered
equipment (implies NO_DEVICES); ORAL_ONLY — no writing, printing, or devices (all steps spoken or
physical). Multiple constraints stack; the agent must satisfy all simultaneously.
