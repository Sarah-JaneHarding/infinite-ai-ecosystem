-- Stage 09 step 1 — Row-Level Security and append-only enforcement for warehouse tables.
--
-- Same shape as Stage 01, 03, 05 and 06 policies, deliberately not factored into a
-- shared procedure: a migration should say exactly what it did, and \d+ on a policy is
-- how an auditor checks this.
--
-- `ingest_run` and `domain_event_log` are the two append-only tables added by Stage 09
-- (the event_log is the canonical append-only ledger of domain events; the run audit
-- is the connector run history). Both receive the `app_forbid_mutation()` trigger
-- that every Brain table already carries.
--
-- The other six tables (ingest_source, raw_ingest_record, source_field_mapping,
-- ingest_quality_report, learner_360, screening_feature) are mutable workflow state —
-- they are updated as data flows through the pipeline — and do NOT get the trigger.

ALTER TABLE "ingest_source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingest_source" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ingest_source"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "ingest_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingest_run" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ingest_run"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "raw_ingest_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "raw_ingest_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "raw_ingest_record"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "domain_event_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domain_event_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "domain_event_log"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "source_field_mapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_field_mapping" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "source_field_mapping"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "ingest_quality_report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingest_quality_report" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ingest_quality_report"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "learner_360" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learner_360" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learner_360"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "screening_feature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "screening_feature" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "screening_feature"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- Append-only enforcement for the two ledger tables
-- ---------------------------------------------------------------------------

CREATE TRIGGER ingest_run_append_only
  BEFORE UPDATE OR DELETE ON "ingest_run"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

CREATE TRIGGER domain_event_log_append_only
  BEFORE UPDATE OR DELETE ON "domain_event_log"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();
