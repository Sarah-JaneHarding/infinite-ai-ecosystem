# Region loss

**RTO:** not committed. Service returns when AWS restores the Region; nothing here can bring it back sooner.
**RPO:** not committed. No copy of the data is held outside the Region, so anything written since AWS's own recovery point depends on AWS restoring the Region intact.

**Status:** rewritten 2026-11-26 (OQ-061, owner decision). The earlier version described a failover to a secondary region: promote a read replica, repoint DNS, restore a Brain snapshot from a `gs://` bucket, RTO ≤ 4 hours, RPO ≤ 60 minutes. **None of that exists.** `infra/terraform` builds no secondary region, no cross-region replica and no off-region copy, and `environments/production/main.tf` says the failover was "deliberately not automated". A runbook that promised a recovery the stack cannot perform is worse than none, because it is believed at the worst moment. This version says what is true.

## What this covers, and what it does not

|                                     | Covered by                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| One availability zone fails         | Production runs Multi-AZ (database and cache standbys, automatic failover). **Staging and dev do not.** Handled by AWS; not this runbook. |
| A bad deploy, corruption, a mistake | `database-restore.md`, `brain-restore.md`, `canary-deploy.md`.                                                                            |
| **The whole Region is unavailable** | **This runbook: there is no failover.** The work is communication and an orderly return.                                                  |

If your AWS project is on the new AWS experience it is limited to one Region, so a second Region is not an option there. Confirm your Region at **AWS Settings → View all projects → Overview → Additional info → Region**.

## What the alert means

The primary Region (`af-south-1`, Cape Town) is inaccessible or has declared an availability incident affecting the database, the object-storage bucket and/or the worker subnet. `web_availability_burn_rate` fires and the gateway's health endpoint returns `503` for more than 5 consecutive minutes.

## Who owns it

On-call platform engineer (technical lead), with the product owner and affected school contacts told within 30 minutes. Data residency still applies: South African schools' data stays in South Africa unless the school has consented to a cross-border transfer (POPIA §72). That is why "just copy it to another Region" is a decision to take in advance (below), not something to improvise during an outage.

## The first action

Confirm it is a Region-level event and not a single-service incident:

1. Check the AWS Health Dashboard and the status page.
2. Try the health endpoint from outside the Region: `curl https://api.infinite-ai.benjaminpine.co.za/health`.
3. If both show a Region problem, declare the incident and start communicating. **Do not start rebuilding elsewhere.**

## How to confirm the diagnosis

- AWS reports `af-south-1` degraded or down.
- `web_availability_burn_rate` is at full burn (near 100% error rate).
- The database does not answer from any host, including ones in the Region's other zones.

## The fix

There is nothing to fail over to. Do these, in order:

1. **Communicate.** Notify every active school contact by email within 30 minutes of declaring the incident, and post a status update every 30 minutes until service returns. Say plainly that the service is unavailable because of a cloud-provider Region incident, that no failover exists, and that you will report when it is back. Do not promise a time you cannot keep.
2. **Do not delete, rebuild or re-point anything** to "get something working". The data is intact inside the Region; a rebuild elsewhere would create a second, divergent copy with no way to reconcile it.
3. **Wait for AWS.** Follow its status. Pause the worker if it is flapping, so queued jobs are not retried against a half-recovered database.
4. **When the Region returns,** do not resume traffic immediately. Run the verification below first, then resume the worker, then the web service.
5. **If data was lost or is inconsistent after recovery,** treat it as an incident of its own: restore using `database-restore.md` into a new instance and reconcile, with the privacy lead. Availability loss alone is not automatically a security compromise under POPIA; the privacy lead decides whether the Information Regulator must be told (cross with `suspected-breach.md`). Do not assume either way.

## A decision to take in advance, not during the outage

Today a Region loss means waiting. If the owner wants a recovery commitment, the options are:

| Option                                                         | Gives you                                              | Costs / catches                                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accept it (recommended for the pilot)**                      | Nothing to build or maintain                           | Tell schools plainly. The draft pilot protocol (`docs/PILOT_PROTOCOL_ONE_SCHOOL_DRAFT.md`, not yet adopted) keeps identifiable learner data out of Phases 0 and 1, so the exposure is availability, not loss of sensitive records. |
| Periodic **encrypted export to a location outside the Region** | A way to rebuild after a total loss, with a stated RPO | Needs a destination that satisfies POPIA §72 (a South African location, or school consent), a key custody plan, and a restore drill. Not built.                                                                                    |
| A second AWS Region                                            | Failover                                               | Not available in a single-Region AWS project; also a large build and a standing cost.                                                                                                                                              |

Reopen this before Phase 2 (identifiable learner data). Until an option other than "accept" is built, keep the RTO and RPO above as "not committed".

## How to verify recovery

- `web_availability_burn_rate` returns to 0.
- The database is reachable and the checks in `restore-drill.md` step 6 (b to e) pass against it: no pending migrations, row-level security on and forced, the append-only triggers present, `verifyChain` intact.
- `SELECT count(*) FROM audit_event WHERE tenant_id = '<tenant>'` matches the count you recorded before the incident, or the difference is explained.
- A synthetic end-to-end run (`pnpm evals:run --all`) succeeds.

## What to record afterwards

- Declaration time, the time AWS reported the Region restored, and the time service resumed (the real outage length).
- Every school notified, and when.
- Whether any data was lost or inconsistent, and what was done about it.
- Whether the privacy lead decided a regulator notification was needed, and why.
- An entry in `docs/RUNBOOKS/drill-results/`, and an update to this runbook if reality differed.

## Which test would have caught this earlier

None: this is outside the application's control. What would have caught the original problem is a check that every resource a runbook names exists in `infra/terraform`; no such check exists (a suggestion). A yearly **tabletop** exercise (walk the communication steps, no restore) is the realistic drill for this runbook; it is not a failover test, because there is no failover.
