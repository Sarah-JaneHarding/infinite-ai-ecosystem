# Source documents — the intake contract for Stage 08

Stage 08 (MOD-01 Curriculum Engine) opens with a ground rule that governs this whole file:

> Before any agent: ingest the supplied CAPS subject statements and ATP files into L0 as
> ratified constitution. **If a source document is missing, stop and ask — do not
> synthesise curriculum.**

So Stage 08 cannot begin until the documents below exist in the repository. This file is
the checklist for obtaining them and the contract for where they go.

## Why this file exists rather than the documents

The authoring environment has no route to the public internet. Direct HTTPS is refused by
the sandbox network policy at the CONNECT stage, and the fetch tool returns 403 for every
host, including ones known to be reachable. `WebSearch` works and returns URLs; nothing
available here can retrieve a file. The documents have to be supplied by a human.

One correction worth recording: **`www.dbe.org.za` does not exist** — it fails DNS
resolution. The Department of Basic Education publishes at **`www.education.gov.za`**.

## Where to get them

| What                                | Where                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| CAPS subject statements             | <https://www.education.gov.za/Curriculum/CurriculumAssessmentPolicyStatements(CAPS).aspx>    |
| National Curriculum Statements R–12 | <https://www.education.gov.za/Curriculum/NationalCurriculumStatementsGradesR-12.aspx>        |
| Policy documents portal (Thutong)   | <https://www.thutong.doe.gov.za/Home/PolicyDocuments/tabid/1952/Default.aspx?PolicyTypeid=1> |

**Take these from the DBE directly, not from a re-hosting site.** Search surfaces several
sites that mirror ATPs. A re-uploaded PDF of unknown vintage is how a curriculum engine
ends up confidently teaching a superseded syllabus, and for a system whose entire claim is
CAPS fidelity, the canon has to be traceable to the department that issued it.

## Scope: full primary, Grades R–7

Confirmed 2026-07-29. This spans three phases, because Grade 7 sits in the Senior Phase:
Foundation (R–3), Intermediate (4–6), Senior (7).

### A note on the subject lists below

The lists are a **procurement checklist, not an authority**. They exist so nothing is
missed when collecting files. The system's understanding of phases, subjects, topics,
weightings and cognitive levels must come from parsing the ingested documents — never from
this file and never from a model's recollection. If a list here disagrees with a document,
the document is right and this file is wrong.

### 1. CAPS subject statements

| Phase        | Grades | Subjects to obtain                                                                                                                                                              |
| ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation   | R–3    | Home Language · First Additional Language · Mathematics · Life Skills                                                                                                           |
| Intermediate | 4–6    | Home Language · First Additional Language · Mathematics · Natural Sciences and Technology · Social Sciences · Life Skills                                                       |
| Senior       | 7      | Home Language · First Additional Language · Mathematics · Natural Sciences · Technology · Social Sciences · Economic and Management Sciences · Life Orientation · Creative Arts |

**Languages — supply only what the school teaches.** CAPS publishes a Home Language
statement per official language, so requesting "all languages" multiplies the set roughly
twelvefold for no benefit. Supply the school's LoLT plus the additional languages it
offers. MOD-04's Home-Language Adapter (Stage 11) is where broader language coverage
becomes relevant, and it is gated on per-language eval sets anyway.

### 2. Annual Teaching Plans

ATPs for the same grades and subjects, for the academic year being planned. ATP pacing is
authoritative in Stage 08 — a deviation requires a stored reason and surfaces in the
coverage audit — so the year must match the year the school is planning.

### 3. Assessment and promotion policy ("grading")

Needed because the manual forbids agents computing or inventing mark allocations:
_"Assessment weightings and mark allocations come from policy in L0. The agent may not
compute or invent them."_ Without these, CE-06 and CE-07 cannot be built.

- National Policy Pertaining to the Programme and Promotion Requirements (NPPPPR)
- School-Based Assessment requirements and weightings for the Foundation, Intermediate and
  Senior Phases
- The national protocol for assessment, Grades R–12
- Any provincial or school-level assessment policy the school actually applies

### 4. Professional development policy ("training")

Needed for Stage 12 (MOD-05), where CPTD point values come from supplied policy and are
never computed by a model.

- SACE CPTD Management System policy and the point-value schedule
- SACE professional development provider and activity criteria

### 5. The school's own documents

Not from the DBE — from the school. These are OQ-003, and Stage 08's template-fidelity
checking is validated structurally against them, so approximations are useless:

- Lesson plan template
- Unit or term plan template
- Formal assessment task template
- Rubric and marking memo template
- Parent progress report template
- The school's assessment policy, if it differs from or extends the national one

## Where to put them

```
docs/sources/
  caps/<phase>/<subject>/<filename>.pdf
  atp/<year>/<phase>/<subject>/<filename>.pdf
  policy/assessment/<filename>.pdf
  policy/cptd/<filename>.pdf
  templates/<artefact-type>/<filename>.<ext>
```

Alongside each directory, a `SOURCES.md` recording for every file: its title, the URL or
person it came from, the publication or revision date, and the date it was retrieved.
Provenance is not bureaucracy here — `explain()` has to be able to trace a lesson plan's
outcome back to a clause in a specific version of a specific document, and that chain
starts at intake.

## A question to settle before ingestion, not after

These are Crown-copyright government publications. Redistributing them inside a
multi-tenant SaaS product is a licensing question rather than a technical one, and it is
cheaper to answer now than after they are embedded in every tenant's L0. The options are
roughly: rely on the DBE's terms for educational reuse, have each school supply its own
copies, or store only derived structure (topic graphs, clause identifiers) rather than the
source text. Recorded as OQ-005.

## Status

**Update 2026-08-13.** Five documents have been supplied:

| Document                                                   | Phase        | Grades | Date       | Status   | Stored                                                                                                |
| ---------------------------------------------------------- | ------------ | ------ | ---------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Draft CAPS — Coding and Robotics, Grades R-3 (DBE)         | Foundation   | R–3    | 2021-03-19 | DRAFT    | Derived structure only — `packages/contracts/src/curriculum/sources/caps-coding-robotics-r3.ts`       |
| CAPS — IsiZulu First Additional Language, Grades 1-3 (DBE) | Foundation   | 1–3    | © 2011     | RATIFIED | Derived structure only — `packages/contracts/src/curriculum/sources/caps-isizulu-fal-gr1-3.ts`        |
| CAPS — Life Skills, Grades R-3 (DBE)                       | Foundation   | R–3    | © 2011     | RATIFIED | Derived structure only — `packages/contracts/src/curriculum/sources/caps-life-skills-r3.ts`           |
| CAPS — Life Skills, Grades 4-6 (DBE)                       | Intermediate | 4–6    | © 2011     | RATIFIED | Derived structure only — `packages/contracts/src/curriculum/sources/caps-life-skills-ip-gr46.ts`      |
| CAPS — Life Orientation, Grades 7-9 (DBE)                  | Senior       | 7–9    | © 2011     | RATIFIED | Derived structure only — `packages/contracts/src/curriculum/sources/caps-life-orientation-sp-gr79.ts` |

**Stage 08 remains blocked.** The documents supplied cover Foundation Phase only, and
only three of the required subjects. Core subjects still missing — Mathematics (all
phases), Home Languages (Foundation, Intermediate, Senior), additional First Additional
Languages (Intermediate, Senior), Natural Sciences and Technology, Social Sciences — and
all per-term ATPs. The authoring environment cannot download them; a human must supply them.

Stage 12 is blocked on §4 (CPTD) for the same supply reason; not yet on the critical path.
