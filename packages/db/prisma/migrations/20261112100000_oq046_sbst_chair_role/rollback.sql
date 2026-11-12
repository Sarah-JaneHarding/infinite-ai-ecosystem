-- Rollback for 20261112100000_oq046_sbst_chair_role (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/user-invitation-rollback.integration.spec.ts. Restores the constraint exactly as migration
-- 20261111110000 wrote it (with `sbst_chair` removed from the list).
--
-- It changes no row, and it is NOT destructive: if any invitation still carries `sbst_chair` the ADD
-- fails, and because both statements run in one transaction the wider constraint stays in place.
-- Revoke or let such invitations expire first. Remove this migration's row from "_prisma_migrations"
-- afterwards (by migration_name) so a later `prisma migrate deploy` re-applies it.

ALTER TABLE "user_invitation" DROP CONSTRAINT "user_invitation_roles_school_staff";

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_roles_school_staff"
    CHECK ("roles" IS NOT NULL
       AND cardinality("roles") >= 1
       AND "roles" <@ ARRAY['teacher', 'hod', 'smt', 'sbst', 'admin']::text[]);
