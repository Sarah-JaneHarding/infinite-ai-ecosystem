# Browser widgets

Single-file HTML widgets for teachers and school staff. They assemble and check; they never decide. A named person
approves before anything is passed on, and no page makes a network call.

| Folder | What is in it |
| --- | --- |
| `built/` | 80 finished widgets: CE (curriculum), DW (data), PD (PD studio), PF (platform: ingestor, approval inbox, Wiring Board PF-W06, POPIA check), SA (support analytics), TB (toolbox, TB-W01 to TB-W20). |
| `MANIFEST.json` | SHA-256, size, widget id and version of every file in `built/`. |
| `studio-kit/` | The Studio layer (`studio.js`), the Wiring Board's custom-widget intake (`intake.js`), the 23 adapters, the 55 agent contracts, synthetic sample data, the injector and its tests. Its README is the user guide. |
| `classroom-tools/` | Sources and user guide for TB-W14 to TB-W20 (register, picker, groups, rotations, scores, noise levels, survey). |

## Changing a widget

1. Replace the file in `built/`.
2. `pnpm widgets:manifest`
3. `pnpm --filter @infinite-ai/widget-registry test`
4. A widget that is school-facing also needs its version bumped and a ratified release (`docs/WIDGET_REGISTRY_DESIGN.md`).

## Where the files came from

Supplied on 2026-11-10 as the Studio and Board Intake and Classroom Tools packages. The Wiring Board in `built/` is the
classroom-tools copy (PF-W06), which also accepts a school-made widget that declares `agentId: null`; the Studio package's
copy did not. The scripts in `studio-kit/` and `classroom-tools/source/` keep the author's machine paths, so they record how
the files were made but do not run from a clean checkout (OQ-044). Their browser tests can be run against `built/` with the paths edited. On ingest the 70 classroom-tool board checks passed, and the Studio edit, ratify and release walk passed for 78 of 80 widgets (PF-W03 and PF-W06 have no Studio panel by design).

## Not here on purpose

A microphone meter, a live poll on learners' own devices, birthday display and anything that reads learner data without a
declared purpose. See `docs/TOOLBOX_CATALOGUE.md`, OQ-045, and `docs/POPIA.md`.
