# Source provenance — CAPS Life Skills, Intermediate Phase, Grades 4-6

## Document

| Field       | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Title       | Curriculum and Assessment Policy Statement: Life Skills, Grades 4-6           |
| Publisher   | Department of Basic Education, Republic of South Africa                       |
| Date        | 2011 (© 2011 DBE)                                                             |
| Status      | **RATIFIED** — official national curriculum statement                         |
| ISBN        | 978-1-4315-0491-6                                                             |
| Page count  | 66                                                                            |
| Document ID | `caps-life-skills-ip-gr46-2011`                                               |
| Extracted   | 2026-08-13 (by mrsharding@benjaminpine.co.za, file uploaded to authoring env) |

## Coverage

- **Phase:** Intermediate
- **Grades:** 4, 5, 6
- **Subject:** Life Skills

## What this document contains

- Subject overview, aims and time philosophy
- Three Intermediate Phase study areas: Personal and Social Well-being, Physical Education, Creative Arts (§2.3)
- Weekly and annual time allocations per study area per grade (§2.3–§2.4, p.10)
- Foundation Phase study area "Beginning Knowledge" is not included in IP

## What this document does NOT contain

- Annual Teaching Plans (topic sequences per term) — these are in a separate ATP document
- Assessment weightings or formal task requirements for IP Life Skills
- Content for Foundation Phase (Grades R–3) or Senior Phase (Grade 7+)
- The "Beginning Knowledge" study area (Foundation Phase only)

## Important: three study areas only

Unlike the Foundation Phase (4 study areas including Beginning Knowledge), Intermediate
Phase Life Skills has exactly three study areas. The `IPLifeSkillsStudyAreaId` enum is
therefore separate from the Foundation Phase `LifeSkillsStudyAreaId` and does not include
`'beginning-knowledge'`.

## Time allocation structure

All three grades have identical annual hour allocations (§2.4, p.10):

- Personal and Social Well-being: 1.5h/week = 60h/year
- Physical Education: 1h/week = 40h/year
- Creative Arts: 1.5h/week = 60h/year
- **Total: 4h/week = 160h/year**

`hoursPerYear` is used (not `hoursPerTerm`) because the document expresses allocations
annually. Values are `z.number().positive()` as all allocations are > 0.

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/caps-life-skills-ip-gr46.ts` stores:

- `CAPS_IP_LIFE_SKILLS_GR46_METADATA` — document identity and metadata
- `CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS` — the three study area identifiers and annual hour allocations
- `EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS` — grade-level totals for cross-validation (160h/year each)

No source text is reproduced (OQ-005: licensing unresolved; safe option is derived structure only).

## Ratification status

This extraction is **not yet ratified**. `ratifiedBy` is `null` throughout the source
registration, which means `GradeFramework.ratifiedAt` will also be `null` for any
framework derived from this document. The gate blocks publication until a human
countersigns the extraction.

## Related open questions

- **OQ-002** — partially addressed; core subjects still missing
- **OQ-005** — licensing of DBE policy documents; derived-structure approach adopted here
