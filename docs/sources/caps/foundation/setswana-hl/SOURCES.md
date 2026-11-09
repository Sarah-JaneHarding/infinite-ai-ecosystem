# Source provenance — CAPS Setswana Home Language, Grades R-3

## Document

| Field       | Value                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Title       | Curriculum and Assessment Policy Statement: Setswana Home Language, Grades R-3           |
| Publisher   | Department of Basic Education, Republic of South Africa                                  |
| Date        | 2011 (© 2011 DBE)                                                                        |
| Status      | **RATIFIED** — official national curriculum statement                                    |
| ISBN        | 978-1-4315-0402-2                                                                        |
| Page count  | 142                                                                                      |
| Language    | Setswana (the statement itself is written in Setswana)                                   |
| Document ID | `caps-setswana-hl-fp-gr-r3-2011`                                                         |
| Extracted   | 2026-11-05 (file uploaded to the authoring environment by mrsharding@benjaminpine.co.za) |

## Coverage

- **Phase:** Foundation
- **Grades:** R, 1, 2, 3
- **Subject:** Setswana Home Language

## What this document contains

- Foundation Phase time allocation (§1.4.1) and the home language allocation by grade (§2.3)
- Assessment: formal tasks per term (§2.4)
- The overview of language skills for Grades R-3 (CAPS pp.25-30): Listening and Speaking, Sounds, Reading and Viewing, Group Guided Reading, Handwriting, Writing
- Requirements per term for each grade, including shared, group and independent writing

## What this document does NOT contain

- Annual Teaching Plans — a separate document
- A Language Structures and Conventions chapter. Language use sits inside the Phonics overview

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/caps-setswana-hl-fp-gr-r3.ts` stores:

- `CAPS_SETSWANA_HL_FP_CONTENT_AREAS` — six content areas
- `CAPS_SETSWANA_HL_FP_TOPIC_PROGRESSIONS` — one English paraphrase per content area per grade (24 rows)
- `CAPS_SETSWANA_HL_FP_WEEKLY_HOURS` — Grade R 10 hours; Grades 1-3 a minimum of 7 and a maximum of 8
- `CAPS_SETSWANA_HL_FP_FORMAL_TASKS_PER_TERM` — 7, 7 and 9 formal tasks a year for Grades 1, 2 and 3
- `CAPS_SETSWANA_HL_FP_METADATA` — document identity

## Rules applied

- Paraphrase only. No sentence of the source is stored (OQ-005). Descriptions are in English because the platform's review screens are in English
- `ratifiedBy` is `null` on every reference until a human countersigns (OQ-002)
- No weighting percentages are stored because this document sets none
- A Setswana-speaking reviewer should check the paraphrases before the entries are ratified
- The Grade 2 and Grade 3 sound-and-spelling entries were read from a merged table layout. A Setswana-speaking reviewer should confirm which grade each item belongs to
