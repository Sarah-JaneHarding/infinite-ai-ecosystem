-- OQ-033 step 1 — Row-Level Security for the invitation table.
--
-- The same shape as every tenant-owned table's policy (Stages 01, 03, 05, 06, 09, 17),
-- deliberately not factored into a shared procedure: a migration should say exactly what it
-- did, and \d+ on a policy is how an auditor checks this. The raising form of
-- current_setting means a query with no tenant context errors rather than matching nothing.
--
-- "user_invitation" is mutable workflow state (PENDING becomes ACCEPTED / REVOKED / EXPIRED),
-- not a ledger: the permanent record that an invitation was issued, accepted or revoked is
-- the audit_event row written in the same transaction (steps 3-4 of the delivery plan).

ALTER TABLE "user_invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_invitation"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);
