-- Stage 03 — Row-Level Security and append-only enforcement for the POPIA tables.
--
-- Same shape as the Stage 01 policies, and deliberately not factored into a shared
-- procedure: a migration should say exactly what it did, and `\d+` on a policy is how an
-- auditor checks this. The repetition is the feature.

ALTER TABLE "consent_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consent_record"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "retention_rule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "retention_rule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "retention_rule"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "data_subject_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_subject_request" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_subject_request"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- The consent ledger is append-only
-- ---------------------------------------------------------------------------
-- "Consent is versioned and never deleted." A withdrawal is a new row; an amendment is a
-- new row; a correction to a mistyped date is a new row. Enforced by the database using
-- the same trigger function the audit ledger uses, so no bug, careless migration or
-- compromised application can quietly rewrite what a school was permitted to do.
--
-- The practical consequence is worth spelling out, because it will be met as an
-- inconvenience before it is met as a protection: there is no way to tidy this table. That
-- is the entire value of it.

CREATE TRIGGER consent_record_append_only
  BEFORE UPDATE OR DELETE ON "consent_record"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Runtime grants for the three new tables
-- ---------------------------------------------------------------------------
-- initdb/02-roles.sh sets default privileges for tables migrator creates, so these are
-- belt and braces for an environment where the roles were created after the fact.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON "consent_record", "retention_rule", "data_subject_request" TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON "consent_record", "retention_rule", "data_subject_request" TO worker_rw;
  END IF;
END;
$$;
