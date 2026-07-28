-- Stage 01 steps 4 and 7 — Row-Level Security, and append-only enforcement on the ledger.
--
-- Prisma cannot express policies, so this migration is hand-written. It is the second
-- line of defence; the tenant-scoped client in src/client.ts is the first (rule 5). Both
-- exist because either one alone is a single point of failure.
--
-- The policy predicate uses current_setting('app.tenant_id', false). The `false` means
-- "raise if the setting is missing" rather than returning NULL. That is deliberate and is
-- what satisfies the exit-gate requirement that a query with no tenant context "fails
-- loudly rather than returning all rows" — a NULL predicate would quietly match nothing,
-- which looks identical to an empty tenant and hides the bug.
--
-- FORCE ROW LEVEL SECURITY is applied so the policy binds the table owner too. Without
-- it, `migrator` — which owns every table — would bypass isolation entirely, and the RLS
-- suite would pass while proving nothing about the role that actually owns the data.

-- ---------------------------------------------------------------------------
-- The tenant table itself
-- ---------------------------------------------------------------------------
-- Keyed by its own id rather than a foreign tenant_id, so its predicate differs. This is
-- the only such table; the coverage test names it explicitly rather than inferring an
-- exemption, so the special case cannot silently grow to cover a table that needs a real
-- policy.

ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "tenant"
  USING      ("id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- Every tenant-owned table
-- ---------------------------------------------------------------------------
-- Written out per table rather than generated in a DO block: a migration should say
-- exactly what it did, and `\d+` on a policy is how an auditor checks this.

ALTER TABLE "tenant_setting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_setting" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_setting"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "user_account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_account" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_account"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "role_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "role_assignment"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "school" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "school"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "phase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phase" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "phase"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "grade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grade" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grade"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "subject" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subject" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subject"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "class_group" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_group" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_group"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "academic_year" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_year" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "academic_year"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "term" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "term" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "term"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "learner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learner" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learner"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "learner_identifier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learner_identifier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learner_identifier"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "guardian" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "guardian"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "guardian_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "guardian_link" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "guardian_link"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "staff_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_member" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "staff_member"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "teaching_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teaching_assignment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "teaching_assignment"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_event"
  USING      ("tenant_id" = current_setting('app.tenant_id', false)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', false)::uuid);

-- ---------------------------------------------------------------------------
-- The audit ledger is append-only
-- ---------------------------------------------------------------------------
-- §1.3 requires an append-only ledger. Enforcing it with a trigger rather than a
-- convention means a bug, a careless migration or a compromised application cannot
-- rewrite history — the database refuses. Stage 02 adds the hash chain that makes a
-- deletion detectable even if someone with DDL rights removes this trigger.

CREATE OR REPLACE FUNCTION app_forbid_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'append-only: % on % is not permitted', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER audit_event_append_only
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION app_forbid_mutation();

-- ---------------------------------------------------------------------------
-- Runtime grants
-- ---------------------------------------------------------------------------
-- initdb/02-roles.sh sets default privileges for tables migrator creates, which covers
-- new tables. These grants cover the tables this migration's predecessor just created, in
-- the case where the roles already existed. Idempotent by nature of GRANT.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO worker_rw;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO worker_rw;
  END IF;
  -- app_rw and worker_rw may INSERT into audit_event but the trigger blocks UPDATE and
  -- DELETE regardless of the grant, so the ledger stays append-only for every role.
END;
$$;
