# Open questions

Part 0 §0.3: stop work, write the question here, and ask, whenever a requirement conflicts
with another, a credential or source document is missing, an operation would be
irreversible, a control would have to be weakened, a CAPS / ATP / SIAS / SACE rule is
ambiguous, PII would be needed in a prompt, an exit gate cannot be met, or a stage would
overrun its budget by more than 30%.

**Never invent curriculum policy, assessment weightings, SIAS process steps or CPTD point
values.** If it is not in a supplied source document, it goes here.

| ID     | Raised     | Stage | Status | Question                                                                                                                                                                                                                                                                                    |
| ------ | ---------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-002 | 2026-07-28 | 08    | OPEN   | The CAPS subject statements and DBE ATP files have not been supplied. Stage 08 cannot begin — the manual is explicit that curriculum must not be synthesised. Which subjects, grades and phases are in scope for the first build, and where do the source PDFs come from?                   |
| OQ-003 | 2026-07-28 | 08    | OPEN   | The school's own artefact templates (lesson plan, unit blueprint, assessment task, rubric, parent report) are needed before template-fidelity checking can be built, since fidelity is validated structurally against a machine-readable definition. Can the current templates be supplied? |
| OQ-004 | 2026-07-28 | 01    | OPEN   | Tenant shape for the seed data: the manual asks for a small primary, a large primary and a school group with two campuses. Should the seed model Benjamin Pine Primary specifically, or stay generic until a pilot tenant is confirmed?                                                     |

## Resolved

### OQ-001 — where the platform lives · resolved 2026-07-29

**Question.** The GitHub integration could not create a repository, so the monorepo was
scaffolded under `infinite-ai/` inside `curriculum-saas-`. Create a dedicated repository
and spin it out, or leave it as a subdirectory?

**Answer.** Create it. `Sarah-JaneHarding/infinite-ai-ecosystem` now exists and the
monorepo was moved to its root via `git subtree split`, carrying all five Stage 00 and
Stage 01 commits. `scripts/spin-out-repo.sh` has served its purpose and is deleted.

This also retires the subdirectory workaround that caused the Stage 00 git-hook defect:
the package root and the git root are now the same directory, which is what Husky assumes.
`scripts/install-hooks.mjs` stays, because it is correct in both layouts and the hooks it
installs are what caught that defect's recurrence.
