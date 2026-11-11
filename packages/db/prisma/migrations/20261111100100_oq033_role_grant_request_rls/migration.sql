-- OQ-033 step 3b — Row-Level Security for the role grant request table.
--
-- The same shape as every tenant-owned table's policy (Stages 01, 03, 05, 06, 09, 17 and the
-- invitation table), deliberately not factored into a shared procedure: a migration should say
-- exactly what it did, and \d+ on a policy is how an auditor checks this. The raising form of
-- current_setting means a query with no tenant context errors rather than matching nothing.
--
-- "role_grant_request" is mutable workflow state (PENDING becomes APPLIED / DECLINED /
-- CANCELLED / EXPIRED), not a ledger: the permanent record that a request was made, applied,
-- declined or cancelled is the audit_event row written in the same transaction.

ALTER TABLE "role_grant_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_grant_request" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "role_grant_request"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);
