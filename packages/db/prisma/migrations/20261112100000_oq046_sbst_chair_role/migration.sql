-- OQ-046 — `sbst_chair` becomes a school staff role an invitation may carry.
--
-- The CHECK constraint "user_invitation_roles_school_staff" spells out the roles an invitation may
-- grant on acceptance. The SBST chair confirms the SBST's draft minutes (MOD-02 `chair-confirmation`),
-- so the role is added to the list. Nothing else changes: "role_grant_request" accepts only the roles
-- that need a second administrator (`admin`, `smt`) and `sbst_chair` is not one of them (design §4.9,
-- decision 2).
--
-- Keeps the explicit `"roles" IS NOT NULL` (a CHECK that evaluates to NULL passes: migration
-- 20261111110000). The DROP and ADD run in one transaction, so a failure leaves the old constraint in
-- place. Widening a list cannot fail on existing rows; no row changes.
--
-- Rollback: rollback.sql in this directory.

ALTER TABLE "user_invitation" DROP CONSTRAINT "user_invitation_roles_school_staff";

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_roles_school_staff"
    CHECK ("roles" IS NOT NULL
       AND cardinality("roles") >= 1
       AND "roles" <@ ARRAY['teacher', 'hod', 'smt', 'sbst', 'sbst_chair', 'admin']::text[]);
