-- Stage 06 step 4 — Row-Level Security for "orchestrator_run" and "orchestrator_step_run".
--
-- Same tenant_isolation shape every other tenant-owned table gets. No append-only trigger
-- here, unlike Stage 05 step 1's Brain tables: both are mutable workflow state, not a
-- Brain fact — see the companion table migration's header for the distinction.

ALTER TABLE "orchestrator_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orchestrator_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orchestrator_run"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "orchestrator_step_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orchestrator_step_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orchestrator_step_run"
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "orchestrator_run" TO app_rw;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "orchestrator_step_run" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "orchestrator_run" TO worker_rw;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "orchestrator_step_run" TO worker_rw;
  END IF;
END;
$$;
