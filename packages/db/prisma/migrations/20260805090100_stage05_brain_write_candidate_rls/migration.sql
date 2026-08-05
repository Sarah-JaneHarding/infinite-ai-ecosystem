-- Stage 05 step 2 — Row-Level Security for "brain_write_candidate".
--
-- Same tenant_isolation shape every other tenant-owned table gets. No append-only
-- trigger here, unlike the Stage 05 step 1 migration: this table is mutable workflow
-- state, not a Brain fact — see the header of the companion table migration for the
-- distinction this draws against `data_subject_request`.

ALTER TABLE "brain_write_candidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_write_candidate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_write_candidate"
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON "brain_write_candidate" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "brain_write_candidate" TO worker_rw;
  END IF;
END;
$$;
