# Source provenance — CAPS IsiZulu First Additional Language, Grades 1-3

## Document

| Field       | Value                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| Title       | Curriculum and Assessment Policy Statement: IsiZulu First Additional Language, Grades 1-3 |
| Publisher   | Department of Basic Education, Republic of South Africa                                   |
| Date        | 2011 (© 2011 DBE)                                                                         |
| Status      | **RATIFIED** — official national curriculum statement                                     |
| ISBN        | 978-1-4315-0419-0                                                                         |
| Page count  | 98                                                                                        |
| Document ID | `caps-isizulu-fal-gr1-3-2011`                                                             |
| Extracted   | 2026-08-13 (by mrsharding@benjaminpine.co.za, file uploaded to authoring env)             |

## Coverage

- **Phase:** Foundation
- **Grades:** 1, 2, 3 (First Additional Language does not apply to Grade R)
- **Subject:** IsiZulu First Additional Language

## What this document contains

- Subject overview, aims and time philosophy (§1–§1.3)
- Four language skill components for Foundation Phase: Listening and Speaking, Reading and Phonics, Writing, Language Use (§2)
- Minimum and maximum weekly time allocations per skill per grade (§2.4, p.10–11)
- Foundation Phase overview describing the shift from oral to written language in Grades 1–3 (§1.2)

## What this document does NOT contain

- Annual Teaching Plans (topic sequences per term) — these are in a separate ATP document
- Assessment weightings or formal task requirements for IsiZulu FAL
- Content for Intermediate Phase (Grades 4–6) or Senior Phase (Grade 7+)
- Home Language coverage — this is a First Additional Language statement only

## Important: Grade R exclusion

CAPS prescribes no First Additional Language time allocation for Grade R. The minimum
timetable table (§2.4, p.10) begins at Grade 1. This is reflected in `grades: ['1','2','3']`
on the metadata and in the `weeklyHoursMin` object, which has keys `grade1`, `grade2`,
`grade3` only.

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/caps-isizulu-fal-gr1-3.ts` stores:

- `CAPS_ISIZULU_FAL_GR13_METADATA` — document identity and metadata
- `CAPS_ISIZULU_FAL_GR13_SKILLS` — the four skill identifiers and their minimum weekly hour allocations per grade
- `EXPECTED_FAL_WEEKLY_HOURS` — grade-level totals for cross-validation (2h/2h/3h per week)

The minimum timetable was chosen as the policy floor (§2.4, p.10). The maximum timetable
(3h/3h/4h per week) is documented in the source PDF but not stored — the minimum is what
every school is required to provide.

No source text is reproduced (OQ-005: licensing unresolved; safe option is derived structure only).

## Schema note: nonnegative, not positive

Language Use (`ukusetshenziswa kolimi`) is allocated 0h in Grades 1 and 2 at the minimum
timetable, and Writing is allocated 0h in Grade 1. The schema therefore uses
`z.number().nonnegative()` rather than `z.number().positive()`. This is correct per §2.4,
p.10–11 of the source document.

## Ratification status

This extraction is **not yet ratified**. `ratifiedBy` is `null` throughout the source
registration, which means `GradeFramework.ratifiedAt` will also be `null` for any
framework derived from this document. The gate blocks publication until a human
countersigns the extraction.

## Related open questions

- **OQ-002** — partially addressed: two more documents supplied; core subjects and ATPs still needed
- **OQ-005** — licensing of DBE policy documents; derived-structure approach adopted here
