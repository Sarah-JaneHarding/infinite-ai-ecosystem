-- Stage 05 step 7 — `audit_event` gains a monotonic `sequence` column.
--
-- `appendAuditEvent` (packages/db/src/audit.ts) originally found "the last event for this
-- tenant" by ordering `at DESC, id DESC`. That tiebreak assumed ties on `at` would be rare
-- and, when they happened, that `id` (a random UUID) would be an acceptable fallback. Both
-- assumptions failed the first time a real caller exercised it: the Brain write path's
-- `run()` reuses one `now` across an entire candidate's journey through every transition,
-- so several audit events for the same candidate can share the exact same `at`. Under that
-- tie, `id DESC` has no correlation with actual insertion order, so the "last event" query
-- could return the wrong row — chaining a new event onto an earlier link instead of the
-- true predecessor, forking the ledger. `sequence` is a plain autoincrementing bigint,
-- independent of any caller-supplied timestamp, so ordering by it always reflects true
-- insertion order regardless of how many events share an `at` value.
ALTER TABLE "audit_event" ADD COLUMN "sequence" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_sequence_idx" ON "audit_event"("tenant_id", "sequence");
