# Source provenance — CAPS Life Skills, Grades R-3

## Document

| Field       | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Title       | Curriculum and Assessment Policy Statement: Life Skills, Grades R-3           |
| Publisher   | Department of Basic Education, Republic of South Africa                       |
| Date        | 2011 (© 2011 DBE)                                                             |
| Status      | **RATIFIED** — official national curriculum statement                         |
| ISBN        | 978-1-4315-0422-0                                                             |
| Page count  | 74                                                                            |
| Document ID | `caps-life-skills-r3-2011`                                                    |
| Extracted   | 2026-08-13 (by mrsharding@benjaminpine.co.za, file uploaded to authoring env) |

## Coverage

- **Phase:** Foundation
- **Grades:** R, 1, 2, 3
- **Subject:** Life Skills

## What this document contains

- Subject overview and integration across the Foundation Phase (§1)
- Four study areas with descriptions: Beginning Knowledge, Creative Arts, Physical Education, Personal and Social Well-being (§1.2)
- Term time allocation per study area per grade (§1.4.1, Table 1, p.6)
- Foundation Phase time allocation table showing hours per week and per term

## What this document does NOT contain

- Annual Teaching Plans (topic sequences per term) — these are in a separate ATP document
- Assessment weightings or formal task requirements for Life Skills
- Content for Intermediate Phase (Grades 4–6) or Senior Phase (Grade 7+)

## Life Skills vs Coding and Robotics

Unlike Coding and Robotics (a draft supplement), this is an official ratified CAPS document
(© 2011). The metadata carries `status: 'RATIFIED'` to reflect this. However, the extraction
itself carries `ratifiedBy: null` pending human countersigning into L0, per the standard
ingestion process.

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/caps-life-skills-r3.ts` stores:

- `CAPS_LIFE_SKILLS_R3_METADATA` — document identity and metadata
- `CAPS_LIFE_SKILLS_R3_STUDY_AREAS` — the four study area identifiers and their term hour allocations per grade
- `EXPECTED_LIFE_SKILLS_TERM_HOURS` — grade-level totals for cross-validation (60h/60h/60h/70h per term)

Hours per term = hours per week × 10 instructional weeks. Grade 3 allocates 7h/week (70h/term)
vs 6h/week (60h/term) for Grades R–2, reflecting increasing curriculum demands.

No source text is reproduced (OQ-005: licensing unresolved; safe option is derived structure only).

## Ratification status

This extraction is **not yet ratified**. `ratifiedBy` is `null` throughout the source
registration, which means `GradeFramework.ratifiedAt` will also be `null` for any
framework derived from this document. The gate blocks publication until a human
countersigns the extraction.

## Related open questions

- **OQ-002** — partially addressed: two more documents supplied; core subjects and ATPs still needed
- **OQ-005** — licensing of DBE policy documents; derived-structure approach adopted here
