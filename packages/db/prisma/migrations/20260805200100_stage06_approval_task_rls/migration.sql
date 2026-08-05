-- Stage 06 step 5 — Row-Level Security for "approval_task".
--
-- Same tenant_isolation shape every other tenant-owned table gets. No append-only trigger
-- here, for the same reason "orchestrator_run"/"orchestrator_step_run" have none: this is
-- mutable workflow state, not a Brain fact — see the companion table migration's header.

ALTER TABLE "approval_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "approval_task" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "approval_task"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- Runtime grants
-- ---------------------------------------------------------------------------
-- initdb/02-roles.sh sets default privileges for tables migrator creates, so this is
-- belt and braces for an environment where the roles were created after the fact.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "approval_task" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "approval_task" TO worker_rw;
  END IF;
END;
$$;
