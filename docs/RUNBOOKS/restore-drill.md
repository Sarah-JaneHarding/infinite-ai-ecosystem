# Live restore drill (staging)

**Audit task:** T19 (prove backup and restore), risk R11. **Status: written 2026-11-26, not yet run.**
`database-restore.md` and `brain-restore.md` are the procedures for a real incident. **This** is the exercise that proves they work, once, in staging,
with synthetic data, and records what actually happened. Run it before any pilot with a school's real content.

**Owner:** the platform engineer. **Needs:** a deployed staging stack (T17 — see `cd-deploy-role-failure.md`), AWS access in that project, and the
owner's say-so to create and later delete a temporary database. **Never** use production, and **never** restore over a live database.

## What exists, and what only looks like it exists

Read this table before trusting any "PASS" in this folder.

| Claim in the repository                                                                                  | What I found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "All runbooks PASS the drill" (`drill-results/*-paper-drill.md`)                                         | Those are **paper drills**: they check that a runbook file exists and declares an RTO/RPO. They never restore anything. They are not restore evidence. Each one says a live drill is still required.                                                                                                                                                                                                                                                                                                |
| RDS point-in-time recovery, RPO ≤ 5 minutes                                                              | Configured in Terraform (`modules/database`: encrypted with a KMS key, `backup_retention_days`). Default retention is **7 days**; staging sets nothing, so it gets 7 days and **no deletion protection**. Production sets 14 days and deletion protection. Never exercised.                                                                                                                                                                                                                         |
| Brain restore: RPO ≤ 60 minutes via hourly snapshots (**withdrawn 2026-11-26**)                          | **I found no job that takes hourly Brain snapshots** anywhere under `apps/`, `packages/` or `infra/`, and none is planned. The Brain is recovered with the database, so its RPO is now declared as the database's (≤ 5 minutes), **unproven until this drill passes**. The Brain restore test (`packages/brain/test/restore.integration.spec.ts`) copies a database inside a test container and proves supersession chains and tombstones survive; it says itself it is not point-in-time recovery. |
| `database-restore.md` step 4: run `test:integration` on the new instance                                 | That suite starts its own test containers (CLAUDE.md: "Testcontainers; real Postgres"), so it **cannot** be pointed at a restored instance. Use the checks in step 6 below instead. The runbook needs correcting.                                                                                                                                                                                                                                                                                   |
| `region-loss.md`: replicate to a secondary region, Brain snapshot at `gs://…` (**rewritten 2026-11-26**) | It described a Google Cloud bucket and a second region the AWS stack does not have. It now says there is **no failover**, and commits to no RTO or RPO for a Region loss. It is still **out of scope** for this drill: there is nothing to restore into.                                                                                                                                                                                                                                            |
| Identity provider backup                                                                                 | There is **no Keycloak module** in `infra/terraform`. Users, roles and enrolled authenticators live in a Keycloak database whose backup is not described anywhere in the repository.                                                                                                                                                                                                                                                                                                                |
| `DB_ENCRYPTION_KEY` safe                                                                                 | The key exists only as a Secrets Manager secret set by hand (30-day deletion recovery window). Without it every encrypted learner identifier is unreadable, and OQ-053 notes there is no re-encryption procedure. No second copy or custody plan is described.                                                                                                                                                                                                                                      |

## Before you start

1. Staging is deployed and healthy; you can sign in to it; the worker and web are on a pinned image tag.
2. Synthetic data only: use the seed (`pnpm --filter @infinite-ai/db db:seed`, idempotent) or data created through the application. **No learner-identifiable data.**
3. Agree a clock to use (UTC) and write down who is doing what. You will record four timestamps.
4. Check the backup settings are what Terraform says (read-only; take the instance name from `terraform output`):

```bash
export AWS_PROFILE=infinite-ai AWS_REGION=af-south-1     # confirm the project's Region first (aws-setup.md §2)
aws rds describe-db-instances --db-instance-identifier <instance> \
  --query 'DBInstances[0].{Retention:BackupRetentionPeriod,Encrypted:StorageEncrypted,Latest:LatestRestorableTime,DeletionProtection:DeletionProtection,MultiAZ:MultiAZ}'
```

**Expect:** `Encrypted` true, `Retention` at least 1, and a `Latest` restorable time within the last few minutes. If `Latest` is empty, point-in-time recovery is not working; stop and fix that first.

## The drill

**1 — Write a marker (T0, T1, T2).** Note **T0** (now). Through the application path (the seed, or a teacher action, never ad-hoc SQL on a live table), create a synthetic record with a unique, recognisable name; note **T1**. Wait about two minutes, then create a **second** record with a different unique name; note **T2**. You are going to restore to a time between T1 and T2.

**2 — Also take a manual snapshot** (tests the second restore path): `aws rds create-db-snapshot --db-instance-identifier <instance> --db-snapshot-identifier drill-<date>`.

**3 — Declare the incident clock.** Note **Tstart**. From here you are being timed (RTO).

**4 — Restore to a new instance, never over the live one:**

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier <instance> \
  --target-db-instance-identifier <instance>-drill \
  --restore-time <a UTC time after T1 and before T2> \
  --db-subnet-group-name <same subnet group> \
  --vpc-security-group-ids <same security groups> \
  --no-publicly-accessible
```

Wait for `available`. Note **Tdb** (database ready). Repeat from the snapshot if you want to time the fallback path.

**5 — Point a throwaway app at it, not production.** Run one staging worker or a one-off task with `DATABASE_URL` set to the drill instance and **`DB_ENCRYPTION_KEY` read from Secrets Manager** (this is the key-recovery test: it must decrypt what the original wrote).

**6 — Verify the restored data.** Read-only checks against the drill instance:

| #   | Check                                                                                                                                  | Expect                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| a   | The T1 record exists; the T2 record does **not**                                                                                       | Yes / not present (RPO is bounded by what you chose)   |
| b   | `prisma migrate status` against it                                                                                                     | No pending or failed migrations                        |
| c   | Row-level security is on and **forced** for every tenant-owned table (`pg_class.relrowsecurity` and `relforcerowsecurity`)             | True for all (the list is `packages/db/src/tables.ts`) |
| d   | The append-only triggers on `audit_event` and `consent_record` exist, and an `UPDATE` is refused (try it in a rolled-back transaction) | Refused                                                |
| e   | `verifyChain` over the audit rows of the drill tenant (`@infinite-ai/telemetry`)                                                       | Intact                                                 |
| f   | An encrypted identifier written before the restore is **decrypted** by the throwaway app using the key from Secrets Manager            | Readable                                               |
| g   | A query with no tenant context fails (the isolation design), and a query with the wrong tenant returns nothing                         | Error / empty                                          |
| h   | Row counts of the main tables match the source at the restore time (within the T1–T2 gap)                                              | Match                                                  |

Note **Tverified** when the last check passes. **RTO = Tverified − Tstart. RPO = the gap between the restore time and the last write you wanted to keep.** Compare with the targets in `database-restore.md` (RTO ≤ 60 min, RPO ≤ 5 min).

**7 — Configuration and identity: what a rebuild would need.** On paper, with the owner, answer each and record the answer (this is the part the repository cannot prove):

- Can the whole stack be recreated from Terraform plus a list of secret **names**? Who holds the secret **values**, and where is the second copy?
- Where is the Keycloak database, who backs it up, and has anyone restored it? Without it nobody can sign in, and authenticator devices must be re-enrolled.
- What happens to queued jobs (Redis) and objects in the object store on a rebuild?
- Who can recover `DB_ENCRYPTION_KEY` if the secret is deleted after its 30-day window? **If the answer is "nobody", that is a finding, not a pass.**

**8 — Clean up, after asking the owner.** The drill instance and manual snapshot cost money. Ask whether to **delete or keep** them, and do what they say. To delete: `aws rds delete-db-instance --db-instance-identifier <instance>-drill --skip-final-snapshot` and `aws rds delete-db-snapshot --db-snapshot-identifier drill-<date>`. Do not touch the original instance. Remove the throwaway app and its task definition.

## What to record

Create `docs/RUNBOOKS/drill-results/<date>-live-restore-drill.md` (name it **live**, to tell it apart from the paper drills) with:

| Item                                                                  | Value |
| --------------------------------------------------------------------- | ----- |
| Date, who ran it, which environment, image tag                        |       |
| T0 / T1 / T2 / restore time                                           |       |
| Tstart / Tdb / Tverified, and the resulting RTO                       |       |
| RPO achieved                                                          |       |
| Checks 6a–6h: pass or fail each, with the output                      |       |
| Snapshot path: RTO if you timed it                                    |       |
| Step 7 answers, including anything answered "nobody"                  |       |
| What you changed in the runbooks because reality differed             |       |
| Whether the drill instance was kept or deleted, and by whose decision |       |

Then add a heading to `docs/STAGE_LOG.md`, update the Feature Matrix row for recovery, and set audit task T19 to done only if 6a–6h passed and step 7 has an owner for every answer.

## Fixes this drill will probably ask for (not done here)

1. Correct `database-restore.md` step 4 (it cannot run the integration suite against a restored instance).
2. ~~Reconcile or retire `region-loss.md`~~ **Done 2026-11-26** (rewritten: no failover, RTO and RPO not committed).
3. ~~Build the hourly Brain snapshot job or drop the 60-minute Brain RPO~~ **Done 2026-11-26** (dropped; the Brain RPO is the database's, ≤ 5 minutes, and is what this drill must now prove).
4. Decide `DB_ENCRYPTION_KEY` custody and write the re-encryption procedure (OQ-053).
5. Put the identity provider's backup and restore on the record (and consider Terraform for it).
6. Set a staging backup retention and deletion protection deliberately, not by default.

## Which test would have caught this earlier

Only a real restore does. A scheduled job that restores the latest snapshot into a scratch instance, runs checks 6b–6e and reports, would catch a silently broken backup the week it breaks. Not built.
