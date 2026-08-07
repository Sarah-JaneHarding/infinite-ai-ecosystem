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
