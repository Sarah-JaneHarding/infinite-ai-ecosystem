# Tenant data erasure

**RTO:** ≤ 8 hours from receiving a verified erasure request to confirmation of deletion.
**RPO:** Not applicable — erasure is a destructive operation performed once on request, not a recovery.

**Status:** Written in Stage 03 (POPIA consent and tombstone mechanism). Drilled in Stage 17 (tenant lifecycle).

## What the alert means

A school (data controller) or a learner's guardian (data subject) has exercised their POPIA §24 right of erasure, or a tenant contract has ended and the off-boarding procedure has reached the erasure step. This is not an automated alert — it is a human-initiated process with a paper trail.

## Who owns it

The POPIA/data-protection contact, with the platform engineer executing the technical steps. The data-protection contact must confirm the legal basis for erasure before any data is deleted.

## The first action

Verify the request in writing (email to the data-protection contact) and confirm:

1. The identity of the requester and their relationship to the data.
2. Which tenant ID and which data subjects are in scope.
3. That no statutory retention obligation overrides the erasure (e.g. an active SIAS case, an exam board record).

**Do not begin deletion until the data-protection contact has confirmed the scope in writing.**

## How to confirm the diagnosis

1. Pull the consent record for the data subject: `pnpm --filter @infinite-ai/policy exec tsx scripts/consent-history.ts --subject <id>`.
2. Confirm there is no active hold (a court order, a pending audit, an open SIAS case).
3. Identify all tables that hold personal information for the subject (see `packages/db/src/tables.ts`, `PII_TABLES`).

## The fix

1. Run the erasure script in dry-run mode first:

   ```bash
   pnpm --filter @infinite-ai/db exec tsx scripts/erase-subject.ts \
     --tenant <id> --subject <id> --dry-run
   ```

   The dry-run prints every row that will be tombstoned and every Brain entry that will be superseded with a deletion record.

2. Confirm the output with the data-protection contact.

3. Run the erasure for real:

   ```bash
   pnpm --filter @infinite-ai/db exec tsx scripts/erase-subject.ts \
     --tenant <id> --subject <id> --actor <platform-admin-id> --reason "popia-erasure-request"
   ```

4. The script:
   - Writes a tombstone to `consent_record` (append-only — the erasure request is itself a consent event).
   - Supersedes all Brain entries for the subject with a deletion record (rule 11 — no destructive Brain write).
   - Removes the subject's rows from `PII_TABLES` that are not covered by a statutory hold.
   - Writes an `audit_event` for each deletion action.

5. The `audit_event` and `consent_record` rows themselves are **not** deleted — they are the proof that the erasure occurred lawfully. POPIA permits retaining records of processing activities.

## How to verify recovery

- `pnpm --filter @infinite-ai/policy exec tsx scripts/consent-history.ts --subject <id>` shows the erasure event as the last entry.
- A full-text search across `PII_TABLES` for the subject's national ID or email returns no rows.
- The Brain retrieval API returns an empty result for the subject's ID.
- The audit chain verifies cleanly: `pnpm --filter @infinite-ai/telemetry exec tsx scripts/verify-chain.ts --tenant <id>`.

## What to record afterwards

- Request received date, confirmation date, completion date (actual RTO).
- Data subjects erased, tables affected, Brain entries superseded.
- Any statutory holds that prevented full erasure (and the reason).
- Entry in `docs/RUNBOOKS/drill-results/` with the date and tenant (anonymised in the record).

## Which test would have caught this earlier

`pnpm --filter @infinite-ai/db test:integration` — the erasure path is tested in the integration suite against a real Postgres, including the append-only audit-event trigger and the tombstone derivation.
