# Paper drill — 2026-08-21

Mode: paper (runbook existence + RTO/RPO declaration check).
A live drill against a staging environment is required before GA.

| Runbook | RTO | RPO | Result |
|---------|-----|-----|--------|
| database-restore.md | ≤ 60min | ≤ 5min | PASS |
| brain-restore.md | ≤ 120min | ≤ 60min | PASS |
| provider-outage.md | ≤ 5min | 0 | PASS |
| queue-backlog.md | ≤ 30min | 0 | PASS |
| bad-prompt-promotion-rollback.md | ≤ 15min | 0 | PASS |
| tenant-data-erasure.md | ≤ 480min | 0 | PASS |
| suspected-breach.md | ≤ 240min | 0 | PASS |
| region-loss.md | ≤ 240min | ≤ 60min | PASS |

Drill completed at 2026-08-21T12:59:58.233Z.
