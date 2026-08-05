# Brain restore

**Status:** written in Stage 05 (step 10), as `docs/RUNBOOKS/README.md`'s own table
specifies. Rehearsed with recorded RTO/RPO evidence in Stage 15 step 7 — that drill,
and the nightly-snapshot/point-in-time-recovery mechanism it drills against, do not
exist yet. This document is the procedure for when they do; do not treat it as proof a
drill has been run. `docs/STAGE_LOG.md`'s Stage 05 write-up says the same thing in more
detail, including why the underlying infrastructure is out of scope here.

## What the alert means

Brain data — L0 policy/CAPS canon, L1 entities and relations, L2 episodes, L3 procedures
— is missing, corrupted, or inconsistent in a way normal application behaviour (a
tombstone, a superseding version) does not explain. Typical triggers: a failed migration
left the schema mid-change, a manual operation touched a Brain table directly and bypassed
the append-only trigger's protections in a way that still corrupted data (e.g. a
superuser `DELETE`), storage-level corruption reported by Postgres, or a Stage 15 backup
integrity check failing.

This is **not** the alert for an ordinary tombstone or supersession — those are the system
working as designed (rule 11) and are never restored away. Confirm the data is actually
wrong before treating this as a restore situation.

## Who owns it

The on-call database/platform engineer. Escalate to the Brain's tech lead if the
corruption's cause is unclear after the first action, and to the POPIA/data-protection
contact if any restored version would reintroduce data a tombstone or erasure had already
removed (a restore must not silently undo a lawful erasure — see "the fix," below).

## The first action

1. Stop writes to the affected tenant(s) if the corruption is actively spreading (pause the
   write path's workers; do not stop reads).
2. Do not run any destructive command (`DELETE`, `TRUNCATE`, `UPDATE`, `DROP`) against a
   Brain table by hand, even to "fix" the symptom. Rule 11 and rule 10 both apply to a
   restore the same way they apply to a normal write: no destructive action without a
   forward path and a tested rollback.
3. Capture the current (corrupted) state before touching anything further: a full
   `pg_dump` of the affected database, and the `audit_event` rows for the affected tenant
   and time range. The corrupted state itself is evidence — for the post-incident record,
   and in case what looked like corruption turns out to be explainable from the ledger.

## How to confirm the diagnosis

- Run `verifyChain` (`@infinite-ai/telemetry`) over the affected tenant's `audit_event`
  rows (`packages/db/src/audit.ts`'s `appendAuditEvent` is what wrote them). A broken link
  or hash mismatch confirms tampering or a partial write, not merely an unexpected but
  legitimate state.
- Walk the affected fact's provenance chain with `explain()` (`@infinite-ai/brain`). A
  chain that does not terminate in a row with `supersedes: null`, or that references an id
  no longer in the table, indicates a genuinely broken chain rather than a fact a caller
  simply did not expect.
- Cross-check against `brain_write_candidate`: a candidate stuck mid-pipeline with a
  `committedRowId` that does not resolve is a different failure mode (a crashed write, not
  corruption) — `advanceOnce`/`run` resume it; that is not a restore situation at all.

## The fix

1. Identify the last known-good point: the most recent nightly snapshot (Stage 15 step 6)
   or WAL position before the corruption, using the recorded RPO for the affected data
   class.
2. Restore Postgres to that point using the point-in-time recovery mechanism Stage 15 step
   6 builds, into a **separate** instance first — never restore over the live database
   directly.
3. Before cutting over, replay every `audit_event` for the affected tenant between the
   restore point and now against the restored instance's data, to identify what a bare
   restore would lose: legitimate writes, tombstones and erasures that happened after the
   snapshot. A restore that reintroduces a fact a tombstone or an erasure request had since
   removed is not a correct recovery — it is a new POPIA incident. Any such case escalates
   to the data-protection contact before cutover, per rule 11 and rule 10 ("destructive
   migrations need a separate, explicitly approved step" applies in reverse here too: an
   _undo_ of a lawful deletion needs the same approval a deletion itself would).
4. Cut over only once the gap between the restore point and now has been reconciled or
   explicitly accepted as data loss within the recorded RPO for that data class.

## How to verify recovery

- `explain()` returns a complete, terminating chain for a sample of facts across all five
  tiers, matching what the pre-corruption audit trail says should exist.
- `verifyChain` reports `intact` for the affected tenant's `audit_event` rows from the
  restore point forward.
- The RLS isolation suite and the Brain write-path integration suite both pass against the
  restored instance before it is promoted to serve production traffic.
- Application-level spot check: a known learner/class/topic's current effective facts
  (via `recall()`) match what was true immediately before the corruption was introduced.

## What to record afterwards

- The corrupted state capture from "the first action," the restore point chosen and why,
  the RPO actually achieved (elapsed time between the restore point and the corruption),
  and the RTO actually achieved (time from alert to verified recovery).
- Every case where reconciliation reintroduced or newly lost a fact, with its provenance
  chain, in `docs/STAGE_LOG.md` and, if a lawful deletion was affected, in the POPIA
  incident log.
- An entry in this runbook's own revision history if the drill (Stage 15) surfaces a step
  here that did not match reality.

## Which test would have caught this earlier, if any

- A corrupted `audit_event` chain: `packages/telemetry/test/audit.spec.ts`'s
  `verifyChain` tests, and `packages/brain/test/write-path.integration.spec.ts`'s audit
  trail test, prove the chain is written correctly in the first place — they would not
  catch storage-level corruption after the fact, which is what this runbook is for.
- A broken provenance chain: `api.integration.spec.ts`'s `explain()` tests (in
  `packages/brain/test`) prove a chain is correct when written; that same directory's
  `restore.integration.spec.ts` is the one that proves a chain survives a real backup and
  restore, which is the exact scenario this runbook exists for.
- A destructive update reaching a Brain table at all: `rls.integration.spec.ts`'s
  `describe.each(APPEND_ONLY_TABLES)` block (in `packages/db/test`) proves the database
  trigger refuses `UPDATE`/`DELETE` on every Brain fact table — the reason this runbook
  should rarely, if ever, be needed for anything but genuine infrastructure failure.
