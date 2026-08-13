# Source provenance — CAPS Life Orientation, Senior Phase, Grades 7-9

## Document

| Field       | Value                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Title       | Curriculum and Assessment Policy Statement: Life Orientation, Grades 7-9      |
| Publisher   | Department of Basic Education, Republic of South Africa                       |
| Date        | 2011 (© 2011 DBE)                                                             |
| Status      | **RATIFIED** — official national curriculum statement                         |
| ISBN        | 978-1-4315-0531-9                                                             |
| Page count  | 38                                                                            |
| Document ID | `caps-life-orientation-sp-gr79-2011`                                          |
| Extracted   | 2026-08-13 (by mrsharding@benjaminpine.co.za, file uploaded to authoring env) |

## Coverage

- **Phase:** Senior
- **Grades:** 7, 8, 9 (document covers all three; project scope is Grades R–7, so Grade 7 is the in-scope grade)
- **Subject:** Life Orientation

## What this document contains

- Subject overview, aims and approach
- Five topic areas for Senior Phase (§2.4, p.9): Development of the self in society, Health/social/environmental responsibility, Constitutional rights and responsibilities, World of work, Physical Education
- Annual contact time allocations per topic per grade (§2.4, p.9)
- Weekly time allocation: 2h/week total (40 teaching weeks, 10h reserved for exams)

## What this document does NOT contain

- Annual Teaching Plans (topic sequences per term) — these are in a separate ATP document
- Assessment weightings for individual topics
- Content for Foundation Phase or Intermediate Phase
- Grade 10–12 Life Orientation (separate CAPS document)

## Important: Grade 7 in scope; Grades 8 and 9 registered for completeness

The project covers Grades R–7. Only Grade 7 falls in scope. However, the document covers
Grades 7, 8, and 9 as a single Senior Phase statement. All three grades are registered
in the derived structure so the extraction faithfully represents the source document.
Only Grade 7 allocations are required for planning in this system.

## Time allocation structure

Annual contact hours per topic (§2.4, p.9), excluding exam time:

| Topic                                           | Grade 7 | Grade 8 | Grade 9 |
| ----------------------------------------------- | ------- | ------- | ------- |
| Development of the self in society              | 10h     | 9h      | 10h     |
| Health, social and environmental responsibility | 10h     | 8h      | 7h      |
| Constitutional rights and responsibilities      | 7h      | 9h      | 7h      |
| World of work                                   | 8h      | 9h      | 11h     |
| Physical Education                              | 35h     | 35h     | 35h     |
| **Total**                                       | **70h** | **70h** | **70h** |

Contact total is 70h/year per grade (2h/week × 40 weeks − 10h exams). The additional 10h
is reserved for examinations and is not included in `EXPECTED_LO_CONTACT_HOURS`.

`hoursPerYear` is used and values are `z.number().positive()` as all allocations are > 0.

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/caps-life-orientation-sp-gr79.ts` stores:

- `CAPS_LO_SP_GR79_METADATA` — document identity and metadata
- `CAPS_LO_SP_GR79_TOPICS` — the five topic identifiers and annual contact hours per grade
- `EXPECTED_LO_CONTACT_HOURS` — grade-level contact totals for cross-validation (70h each)

No source text is reproduced (OQ-005: licensing unresolved; safe option is derived structure only).

## Ratification status

This extraction is **not yet ratified**. `ratifiedBy` is `null` throughout the source
registration, which means `GradeFramework.ratifiedAt` will also be `null` for any
framework derived from this document. The gate blocks publication until a human
countersigns the extraction.

## Related open questions

- **OQ-002** — partially addressed; core subjects still missing
- **OQ-005** — licensing of DBE policy documents; derived-structure approach adopted here
