# Runbooks

Every alert links to a runbook here, and every runbook names an owner and a first action.
A runbook that has not been rehearsed does not count — Stage 15 requires them written
**and** drilled, with the evidence recorded in `STAGE_LOG.md`.

## Required runbooks

| Runbook                            | Stage it lands             | Drill cadence              |
| ---------------------------------- | -------------------------- | -------------------------- |
| `database-restore.md`              | 15                         | Quarterly                  |
| `brain-restore.md`                 | 05 (written), 15 (drilled) | Quarterly                  |
| `provider-outage.md`               | 04 (written), 15 (drilled) | Quarterly                  |
| `queue-backlog.md`                 | 15                         | Quarterly                  |
| `bad-prompt-promotion-rollback.md` | 13                         | Quarterly                  |
| `tenant-data-erasure.md`           | 03 (written), 17 (drilled) | On request, plus quarterly |
| `suspected-breach.md`              | 16                         | Annually                   |
| `region-loss.md`                   | 15                         | Annually                   |

## Infrastructure walkthroughs

| Runbook               | What it covers                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `aws-setup.md`        | AWS CLI and region, state backend, budget, apply, populating secrets, proving they are injected |
| `secrets-rotation.md` | The static-secrets position, the 90-day cadence, and per-secret rotation steps                  |

## Format

Each runbook states, in this order: what the alert means · who owns it · the first action
· how to confirm the diagnosis · the fix · how to verify recovery · what to record
afterwards · which test would have caught this earlier, if any.
