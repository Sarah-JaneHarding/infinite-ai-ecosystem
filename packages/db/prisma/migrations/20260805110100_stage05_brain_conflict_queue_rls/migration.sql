-- Stage 05 step 3 — Row-Level Security for "brain_conflict_queue".
--
-- Same tenant_isolation shape every other tenant-owned table gets. No append-only
-- trigger: a conflict queue entry is resolved in place (status, resolution, resolvedBy,
-- resolvedAt set once a human decides), the same mutable-workflow-state shape
-- "brain_write_candidate" itself has.

ALTER TABLE "brain_conflict_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_conflict_queue" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_conflict_queue"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "brain_conflict_queue" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "brain_conflict_queue" TO worker_rw;
  END IF;
END;
$$;
