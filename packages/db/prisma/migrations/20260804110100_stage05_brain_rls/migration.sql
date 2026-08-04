-- Stage 05 step 1 — Row-Level Security and append-only enforcement for the Brain tables.
--
-- Same shape as the Stage 01 and Stage 03 policies, deliberately not factored into a
-- shared procedure: a migration should say exactly what it did, and `\d+` on a policy is
-- how an auditor checks this.
--
-- All six tables get the append-only trigger, reusing `app_forbid_mutation()` from the
-- Stage 01 migration. "No destructive update anywhere; old versions remain readable" is a
-- named exit-gate item for this stage: a correction, a re-embedding or a tombstone is
-- always a new row whose `supersedes` points at the one it replaces, never an UPDATE of
-- the row itself.

ALTER TABLE "brain_constitution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_constitution" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_constitution"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "brain_node" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_node" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_node"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "brain_edge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_edge" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_edge"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "brain_embedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_embedding" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_embedding"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "brain_episode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_episode" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_episode"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "brain_procedure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brain_procedure" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brain_procedure"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- Every Brain table is append-only
-- ---------------------------------------------------------------------------

CREATE TRIGGER brain_constitution_append_only
  BEFORE UPDATE OR DELETE ON "brain_constitution"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER brain_node_append_only
  BEFORE UPDATE OR DELETE ON "brain_node"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER brain_edge_append_only
  BEFORE UPDATE OR DELETE ON "brain_edge"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER brain_embedding_append_only
  BEFORE UPDATE OR DELETE ON "brain_embedding"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER brain_episode_append_only
  BEFORE UPDATE OR DELETE ON "brain_episode"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER brain_procedure_append_only
  BEFORE UPDATE OR DELETE ON "brain_procedure"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Runtime grants for the six new tables
-- ---------------------------------------------------------------------------
-- initdb/02-roles.sh sets default privileges for tables migrator creates, so these are
-- belt and braces for an environment where the roles were created after the fact.
-- app_rw and worker_rw may INSERT into every table here; the triggers above block UPDATE
-- and DELETE regardless of the grant, so every one of them stays append-only.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON "brain_constitution", "brain_node", "brain_edge", "brain_embedding",
         "brain_episode", "brain_procedure" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON "brain_constitution", "brain_node", "brain_edge", "brain_embedding",
         "brain_episode", "brain_procedure" TO worker_rw;
  END IF;
END;
$$;
