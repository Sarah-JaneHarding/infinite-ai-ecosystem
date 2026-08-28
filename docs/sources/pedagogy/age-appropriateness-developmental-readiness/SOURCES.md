# Source provenance — age-appropriateness / developmental-readiness clauses

## Dataset

| Field            | Value                                                                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose          | Populates OQ-015's blocked policy input — real developmental-readiness source material for `checkAgeAppropriateness`                                                                                                                                  |
| Source authority | South African Department of Basic Education (DBE), education.gov.za                                                                                                                                                                                   |
| Entry count      | 206                                                                                                                                                                                                                                                   |
| Source documents | 23 (see table below)                                                                                                                                                                                                                                  |
| Phases covered   | Foundation (69 entries), Intermediate (62 entries), Senior (75 entries)                                                                                                                                                                               |
| Subjects covered | 13 (Mathematics, Home Language, First Additional Language, Coding and Robotics, Life Skills, Social Sciences/Science, Natural Science(s), Technology, Creative Arts, Natural Sciences and Technology, Life Orientation, Economic Management Sciences) |
| Supplied         | 2026-08-25, by mrsharding@benjaminpine.co.za, as a structured extraction dataset (file upload to authoring env)                                                                                                                                       |
| Status           | **Not ratified.** `ratifiedBy` is `null` throughout every entry's `SourceRef`.                                                                                                                                                                        |

## What this dataset contains

One paraphrased clause per entry — a developmental-readiness or age-appropriateness
statement drawn from a real DBE CAPS document, tagged with its phase, grade range,
subject and a free-form `clauseType` describing what kind of claim it makes (e.g.
`progression`, `developmental_pacing`, `readiness_gate`,
`assessment_age_appropriateness`). Every entry carries a `SourceRef`-shaped citation
(`documentId`, `documentVersion`, `clause`, `ratifiedBy: null`) — nothing here is
invented (rule 0.3); every clause traces to a specific document and section.

Deliberately one entry per clause, not one entry per source document: this dataset
exists to be individually retrieved by a RAG query or a guardrail check asking "is this
developmentally appropriate for grade N", and bundling a whole document's worth of
unrelated clauses under one key would dilute exactly the retrieval granularity the
guardrail needs.

## What this dataset does NOT contain

- Verbatim source text — every `content` field is a paraphrase (OQ-005: no DBE PDF text
  is reproduced in this repository, the same discipline every other CAPS source under
  `docs/sources/` already follows).
- A ratified taxonomy for `clauseType` — it is descriptive, extraction-pass metadata,
  not a policy vocabulary this codebase commits to.
- Assessment weightings, mark allocations, or ATP term sequencing — those are separate
  source families, already covered (where ingested) by this repo's other
  `docs/sources/caps/**/SOURCES.md` files for the same underlying documents.
- A human ratification signature. This is an extraction, not yet a countersigned policy
  fact — see "Ratification status" below.

## Source documents

23 distinct DBE CAPS documents. `documentId` is the slug used in
`packages/contracts/src/curriculum/sources/age-appropriateness-developmental-readiness.ts`;
`documentVersion` is `'draft-2021'` for the two documents whose own filename states a
19 March 2021 draft gazette date, and `'caps-current'` for every other (officially
gazetted) document — deliberately not asserting an unverified precise gazette year for
documents where one wasn't confirmed.

| #   | `documentId`                                                                                     | Phase / Subject                                | Entries | Source URL / note                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `age-appropriateness-src-caps-english-hl-grades-r-3-fs`                                          | Foundation · Home Language                     | 15      | education.gov.za — CAPS English HL Grades R-3 FS.pdf                                                                                                                                                                                                                        |
| 2   | `age-appropriateness-src-caps-maths-english-gr-r-fs`                                             | Foundation · Mathematics                       | 15      | education.gov.za — CAPS Maths English Gr R FS.pdf                                                                                                                                                                                                                           |
| 3   | `age-appropriateness-src-fal`                                                                    | Foundation · First Additional Language         | 12      | education.gov.za — Documents/FAL.pdf                                                                                                                                                                                                                                        |
| 4   | `age-appropriateness-src-life-skills`                                                            | Foundation · Life Skills                       | 12      | education.gov.za — Documents/Life_Skills.pdf                                                                                                                                                                                                                                |
| 5   | `age-appropriateness-src-grade-r-3-coding-and-robotics-draft-caps-final-19mar2021`               | Foundation · Coding and Robotics               | 10      | education.gov.za — Grade R-3 Coding and Robotics Draft CAPS Final 19Mar2021.pdf (draft, gazetted 19 Mar 2021)                                                                                                                                                               |
| 6   | `age-appropriateness-src-grades-1-to-3`                                                          | Foundation · Mathematics                       | 5       | education.gov.za — Policies/CAPS/Grades 1 to 3.pdf                                                                                                                                                                                                                          |
| 7   | `age-appropriateness-src-caps-ip-home-english-gr-4-6-web`                                        | Intermediate · Home Language                   | 10      | education.gov.za — CAPS IP HOME ENGLISH GR 4-6 WEB.pdf                                                                                                                                                                                                                      |
| 8   | `age-appropriateness-src-caps-ip-social-sciences-web`                                            | Intermediate · Social Sciences                 | 11      | education.gov.za — CAPS IP SOCIAL SCIENCES WEB.pdf                                                                                                                                                                                                                          |
| 9   | `age-appropriateness-src-caps-ip-mathematics-gr-4-6-web`                                         | Intermediate · Mathematics                     | 9       | education.gov.za — CAPS IP MATHEMATICS GR 4-6 web.pdf                                                                                                                                                                                                                       |
| 10  | `age-appropriateness-src-grade4-6-coding-and-robotics-draft-caps-final-19march2021`              | Intermediate · Coding and Robotics             | 9       | education.gov.za — Grade4-6 Coding and Robotics Draft CAPS FINAL 19March2021.pdf (draft, gazetted 19 Mar 2021)                                                                                                                                                              |
| 11  | `age-appropriateness-src-caps-ip-life-skills-gr-4-6-web`                                         | Intermediate · Life Skills                     | 8       | education.gov.za — CAPS IP LIFE SKILLS GR 4-6 WEB.pdf                                                                                                                                                                                                                       |
| 12  | `age-appropriateness-src-ns-and-tech-ip-grades-4-6-edited2`                                      | Intermediate · Natural Sciences and Technology | 8       | education.gov.za — NS AND TECH IP GRADES 4-6 EDITED2.pdf, via a DBE-sourced mirror (ISBN 978-1-4315-0490-9)                                                                                                                                                                 |
| 13  | `age-appropriateness-src-caps-ip-fal-english-gr-4-6-web`                                         | Intermediate · First Additional Language       | 7       | education.gov.za — CAPS IP FAL ENGLISH GR 4-6 WEB.pdf                                                                                                                                                                                                                       |
| 14  | `age-appropriateness-src-caps-sp-mathematics-gr-7-9`                                             | Senior · Mathematics                           | 11      | education.gov.za — CAPS SP MATHEMATICS GR 7-9.pdf                                                                                                                                                                                                                           |
| 15  | `age-appropriateness-src-caps-sp-creative-arts-gr-7-9-web`                                       | Senior · Creative Arts                         | 9       | education.gov.za — CAPS SP CREATIVE ARTS GR 7-9 web.pdf                                                                                                                                                                                                                     |
| 16  | `age-appropriateness-src-caps-sp-natural-sciences-gr-7-9-web`                                    | Senior · Natural Science                       | 9       | education.gov.za — CAPS SP NATURAL SCIENCES GR 7-9 WEB.pdf                                                                                                                                                                                                                  |
| 17  | `age-appropriateness-src-caps-sp-technology-gr-7-9`                                              | Senior · Technology                            | 9       | education.gov.za — CAPS SP TECHNOLOGY GR 7-9.pdf                                                                                                                                                                                                                            |
| 18  | `age-appropriateness-src-caps-sp-fal-english-gr-7-9-web`                                         | Senior · First Additional Language             | 8       | education.gov.za — CAPS SP FAL ENGLISH GR 7-9 WEB.pdf                                                                                                                                                                                                                       |
| 19  | `age-appropriateness-src-caps-sp-social-science-gr-7-9`                                          | Senior · Social Science                        | 7       | education.gov.za — CAPS SP SOCIAL SCIENCE GR 7-9.pdf                                                                                                                                                                                                                        |
| 20  | `age-appropriateness-src-caps-sp-life-orientation-gr-7-9-web`                                    | Senior · Life Orientation                      | 7       | education.gov.za — CAPS SP LIFE ORIENTATION GR 7-9 WEB.pdf, via a DBE-identical mirror (direct link not resolved this session)                                                                                                                                              |
| 21  | `age-appropriateness-src-draft-caps-coding-and-robotics-grades-7-9-department-of-basic-educatio` | Senior · Coding and Robotics                   | 6       | Draft CAPS Coding and Robotics Grades 7-9, gazetted 19 Mar 2021 — accessed via `caps123.co.za`, a third-party summary site; the education.gov.za PDF link was not resolved this session. **Treat quoted phrases as paraphrase-level confidence, not verbatim source text.** |
| 22  | `age-appropriateness-src-caps-sp-ems-gr-7-9`                                                     | Senior · Economic Management Sciences          | 5       | education.gov.za — CAPS SP EMS GR 7-9.pdf, via a DBE-identical mirror (ISBN 978-1-4315-0530-2, direct link not resolved this session)                                                                                                                                       |
| 23  | `age-appropriateness-src-caps-sp-home-english-gr-7-9-web`                                        | Senior · Home Language                         | 4       | education.gov.za — CAPS SP HOME ENGLISH GR 7-9 WEB.pdf, via a DBE-identical mirror (same ISBN 978-1-4315-0492-3 and DBE disclaimer text as the direct document, direct link not resolved this session)                                                                      |

Three of the 23 documents (#20, #21, #22 above) were verified against mirrors rather
than the `education.gov.za` URL directly — each mirror's ISBN and/or disclaimer text
was cross-checked against the corresponding official DBE document to confirm it is the
same publication, not a substitute. #21 carries a materially weaker confidence bound
(a third-party paraphrase site, not a document mirror) and is flagged as such in the
dataset itself and in the table above.

## Derived structure in this codebase

`packages/contracts/src/curriculum/sources/age-appropriateness-developmental-readiness.ts`
stores all 206 entries as `AGE_APPROPRIATENESS_ENTRIES`, each shaped as an
`AgeAppropriatenessSourceEntry` (`phase`, `gradeRange`, `subject`, `clauseType`,
`content`, `source: SourceRef`). `packages/brain/src/age-appropriateness.ts` is the L0
write/read wrapper (`submitAgeAppropriatenessEntry`/`selectAgeAppropriatenessEntries`),
following the same `BrainConstitutionKind` pattern Stage 08's `'TEMPLATE'` kind
established — a new `'AGE_APPROPRIATENESS'` kind, its first and only user.

No source PDF text is reproduced anywhere in this codebase (OQ-005).

## Ratification status

This extraction is **not yet ratified**. `ratifiedBy` is `null` throughout every entry's
`source`, and submission (`scripts/seed-age-appropriateness.ts`) always forces it to
`null` regardless of what's passed in — ratification is a separate human decision made
through the Brain API's own `ratify()` (rule 6), never implied by ingestion.

## Related open questions

- **OQ-015** — this dataset is the real, sourced policy material `checkAgeAppropriateness`
  was blocked on; ingesting it into L0 unblocks the data side of that gap. It does not by
  itself resolve OQ-015: the guardrail's runtime checker (`packages/guardrails/src/
output-checks.ts`) is still synchronous and does not yet query Brain retrieval — wiring
  a real runtime read of these clauses is a separate, larger follow-up (a breaking
  signature change to `AgeAppropriatenessChecker` and its call site in
  `apps/worker/src/step-executor.ts`), not undertaken here.
- **OQ-005** — licensing of DBE policy documents; the same derived-structure-only
  approach already adopted for every other CAPS source in this repository.
