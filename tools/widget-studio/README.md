# Widget Studio, Board and classroom-tool sources

Source for the add-ons injected into the single-file widgets in `apps/web/public/widgets/`.

| Path                                | What it is                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `studio.js`                         | The Studio panel: document and file views, agent-contract tab, revision, ratification, Send to code, roll back |
| `intake.js`                         | The Board's custom-widget intake (PF-W06): audit, SMT ratification, private or public, offers      |
| `adapters/`                         | One adapter per widget that lays its output out the way its agent contract asks (23 widgets)       |
| `adapters/_blocked.json`            | The widgets that cannot be laid out and why (OQ-040, OQ-041)                                       |
| `agent-contracts.json`              | A snapshot of the agent contracts the adapters were checked against. Regenerate from the repo; it can drift |
| `samples/`                          | Synthetic sample data for each widget (no real learner data)                                       |
| `inject_studio.py`, `build_studio.py` | Inject `studio.js` into a built widget                                                          |
| `classroom/`                        | `cls.js` (fair random picker, timer, sounds, themes) and TB-W14 to TB-W20                          |
| `t*.py`                             | Playwright test drivers                                                                            |

## Read this before relying on it

- **The shared widget kit is not here.** The widgets were assembled from a kit (`kit_all.js`, `ce.js`, `dw.js`,
  `sa.js`, `tb.js`, `pd.js`, `qms.js`, `qms2.js`) that was not in the hand-over. The archived HTML in
  `apps/web/public/widgets/` is the compiled result and the source of truth until the kit is supplied.
- **The Python scripts have sandbox paths** (`/home/claude/widgets/...`) hard-coded. Edit the paths at the top of
  each script before running it.
- The agent-contract snapshot and the adapters follow `docs/WIDGET_REGISTRY_DESIGN.md`. Nothing here writes to a
  database, calls a model, or sends anything: a release package is a file a person hands over.
