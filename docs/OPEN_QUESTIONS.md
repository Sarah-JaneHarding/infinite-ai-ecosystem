# Open questions

Part 0 §0.3: stop work, write the question here, and ask, whenever a requirement conflicts
with another, a credential or source document is missing, an operation would be
irreversible, a control would have to be weakened, a CAPS / ATP / SIAS / SACE rule is
ambiguous, PII would be needed in a prompt, an exit gate cannot be met, or a stage would
overrun its budget by more than 30%.

**Never invent curriculum policy, assessment weightings, SIAS process steps or CPTD point
values.** If it is not in a supplied source document, it goes here.

| ID     | Raised     | Stage | Status | Question                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ---------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-001 | 2026-07-28 | 00    | OPEN   | The GitHub integration for this session cannot create repositories (`403 Resource not accessible by integration`). The monorepo has been scaffolded under `infinite-ai/` in the existing repository instead. Should the owner create `Infinite-AI-Ecosystem` on GitHub and run `scripts/spin-out-repo.sh`, or should the platform stay in this repository as a subdirectory? |
| OQ-002 | 2026-07-28 | 08    | OPEN   | The CAPS subject statements and DBE ATP files have not been supplied. Stage 08 cannot begin — the manual is explicit that curriculum must not be synthesised. Which subjects, grades and phases are in scope for the first build, and where do the source PDFs come from?                                                                                                    |
| OQ-003 | 2026-07-28 | 08    | OPEN   | The school's own artefact templates (lesson plan, unit blueprint, assessment task, rubric, parent report) are needed before template-fidelity checking can be built, since fidelity is validated structurally against a machine-readable definition. Can the current templates be supplied?                                                                                  |
| OQ-004 | 2026-07-28 | 01    | OPEN   | Tenant shape for the seed data: the manual asks for a small primary, a large primary and a school group with two campuses. Should the seed model Benjamin Pine Primary specifically, or stay generic until a pilot tenant is confirmed?                                                                                                                                      |

## Resolved

None yet. When a question is answered, move its row here with the answer and the date, and
link the commit that acted on it.
