# Retention schedule — ratification template

**For:** the governing body of ******\_\_\_\_******
**Prepared:** **\_\_\_\_** **Ratified:** **\_\_\_\_**

---

## What this document is

POPIA §14(1) says personal information must not be kept longer than is necessary for the
purpose it was collected for, **unless a law requires or permits a longer period**. For a
school that exception does a great deal of the work: several learner records carry
retention periods set by statute, not by the school's preference.

INFINITE-AI enforces a retention schedule. It does not supply one, and it will not.

The periods are a legal determination about your school's records. A default shipped in
software would be wrong in a way nobody checks, and it would destroy records on a timetable
no person ever agreed to. So the system holds the shape of a schedule and the arithmetic to
apply it, and this form is where the numbers come from.

**Until a category has a ratified rule below, nothing in it is ever deleted
automatically.** It appears instead on an "unscheduled categories" report on every
retention run. That is deliberate: erring toward keeping data is itself a §14 exposure, so
the gap is made loud rather than silent.

> **This template is not legal advice.** It is a form for recording a decision your school
> takes with its own advisors. Nothing in it has been checked against South African law by
> the people who built this system.

---

## What each row needs

A rule is only accepted by the system if it carries all four. The fourth is the one people
try to skip.

| Field               | What it means                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**        | Which kind of information. Fixed list — see below.                                                                                                                                |
| **Anchor**          | The event the clock runs from. "Five years" means nothing until you say five years from what.                                                                                     |
| **Retain (months)** | Whole months from the anchor.                                                                                                                                                     |
| **Authority**       | The Act, regulation, circular or minuted resolution this period rests on. A period nobody can source gets withdrawn the first time it is challenged, usually at the worst moment. |

### The anchors

| Anchor              | Runs from                                                     | Typically suits                  |
| ------------------- | ------------------------------------------------------------- | -------------------------------- |
| `RECORD_CREATED`    | The day the record was written.                               | Transient operational data.      |
| `ACADEMIC_YEAR_END` | The end of the academic year the record belongs to.           | Marks, attendance.               |
| `SUBJECT_EXIT`      | The day the learner left — transferred, graduated, withdrawn. | Enrolment and admission records. |
| `CASE_CLOSED`       | The day the support case was formally closed.                 | SIAS intervention records.       |

The anchor choice matters more than it looks. For a learner who joins in Grade R and leaves
after Grade 7, `RECORD_CREATED` and `SUBJECT_EXIT` are about **seven years apart** for the
same record.

---

## The schedule

Fill in one row per category. Leave a row blank if the school has not decided — blank is a
safe state, and the system will keep reporting it.

| #   | Category               | What it covers                                                      | Anchor | Retain (months) | Authority |
| --- | ---------------------- | ------------------------------------------------------------------- | ------ | --------------- | --------- |
| 1   | `IDENTIFIER_TOKEN`     | The pseudonym itself. Holds no personal information on its own.     | ______ | ______          | ________  |
| 2   | `DIRECT_IDENTIFIER`    | Name, ID number, date of birth, address, contact details.           | ______ | ______          | ________  |
| 3   | `ENROLMENT`            | Grade, class, subjects, enrolment status.                           | ______ | ______          | ________  |
| 4   | `ACADEMIC_PERFORMANCE` | Marks, assessment results, academic progress.                       | ______ | ______          | ________  |
| 5   | `ATTENDANCE`           | Presence, absence, punctuality.                                     | ______ | ______          | ________  |
| 6   | `BEHAVIOUR`            | Conduct records, incidents.                                         | ______ | ______          | ________  |
| 7   | `SUPPORT_NEED`         | Screening scores, tier decisions, intervention history.             | ______ | ______          | ________  |
| 8   | `SPECIAL_PERSONAL`     | **POPIA §26** — health, disability, biometrics. Strictest handling. | ______ | ______          | ________  |
| 9   | `FAMILY_CONTEXT`       | Home language, guardian relationships, communication preferences.   | ______ | ______          | ________  |
| 10  | `STAFF_PRACTICE`       | Teacher-level practice data. Developmental only.                    | ______ | ______          | ________  |

### Notes for whoever fills this in

- **Row 8 deserves its own conversation.** Special personal information under §26 carries
  stricter handling and, ordinarily, a shorter life than the rest. If it ends up with the
  longest period on this page, that is worth a second look.
- **Row 1 is not like the others.** A token is meaningless once the identifiers it points at
  are gone. Keeping tokens longer is what lets the school say "a learner in this class was
  referred in Term 3" after the child can no longer be identified — which is usually the
  intent, not an oversight.
- **One category, one period.** There is deliberately no catch-all row. A default would
  quietly govern categories nobody discussed, which is how §26 material ends up on the same
  clock as a class list.

---

## Where the answers usually come from

Starting points only — **each must be confirmed by the school's own legal advisor.** These
have not been verified against current law by the people who built this system, and the
specific periods they set are not reproduced here for exactly that reason.

- **Protection of Personal Information Act 4 of 2013**, §14 — the general rule and its
  exceptions.
- **South African Schools Act 84 of 1996** and its provincial regulations — admission and
  attendance registers.
- **National Archives and Record Service of South Africa Act 43 of 1996** — applies to
  public bodies' records and may set disposal authorities relevant to a public school.
- Your **provincial education department's** records-management directives and circulars.
- The school's own minuted governing-body resolutions, where no external rule applies.

If two sources conflict, record the longer period and note the conflict in the Authority
column. The system will enforce whatever is written here.

---

## Entering a ratified schedule

Once signed, each row becomes one record. The system validates the whole schedule before
accepting it and refuses a rule with a missing or placeholder authority.

```jsonc
{
  "tenantId": "<the school's tenant id>",
  "rules": [
    {
      "category": "ATTENDANCE",
      "anchor": "ACADEMIC_YEAR_END",
      "retainMonths": 0, // ← the ratified figure from the table above
      "authority": "<Act, regulation, circular or minuted resolution>",
      "ratifiedAt": "2026-__-__T00:00:00.000Z",
      "ratifiedBy": "<governing body>",
    },
  ],
}
```

Check it before it goes anywhere near the database:

```bash
pnpm check:retention path/to/schedule.json
```

That reports every category still unscheduled, and refuses anything malformed or
placeholder-filled. A schedule that does not pass this check is not loaded.

---

## Signatures

| Role                        | Name | Signature | Date |
| --------------------------- | ---- | --------- | ---- |
| Chairperson, governing body |      |           |      |
| Principal                   |      |           |      |
| Information Officer         |      |           |      |

---

Tracked as **OQ-007** in `docs/OPEN_QUESTIONS.md`. Enforcement lives in
`packages/contracts/src/popia/retention.ts`; the reasoning behind shipping no periods is in
`docs/POPIA.md` §5.1.
