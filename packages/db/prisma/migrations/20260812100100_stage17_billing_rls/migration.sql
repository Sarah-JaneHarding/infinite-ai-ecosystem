-- Stage 17 — Row-Level Security for provisioning and billing tables.
--
-- Same shape as Stages 01, 03, 05, 06 and 09 policies, deliberately not factored into a
-- shared procedure: a migration should say exactly what it did, and \d+ on a policy is
-- how an auditor checks this.
--
-- `tenant_metering_event` is append-only (trigger applied in the tables migration).
-- All five tables receive RLS; the five-table set is listed here for an auditor's
-- single-read verification.

ALTER TABLE "provisioning_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provisioning_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "provisioning_record"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "tenant_metering_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_metering_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_metering_event"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "metering_period" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "metering_period" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "metering_period"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "tenant_invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_invoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_invoice"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);
