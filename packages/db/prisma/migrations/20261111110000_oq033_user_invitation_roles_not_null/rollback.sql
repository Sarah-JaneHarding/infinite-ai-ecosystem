-- Rollback for 20261111110000_oq033_user_invitation_roles_not_null (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/user-invitation-rollback.integration.spec.ts. Restores the constraint exactly as migration
-- 20261024090000 wrote it, which accepts a NULL "roles" (see the forward migration's header). It
-- changes no row. Remove its row from "_prisma_migrations" afterwards (by migration_name) so a later
-- `prisma migrate deploy` re-applies it rather than believing it ran.

ALTER TABLE "user_invitation" DROP CONSTRAINT "user_invitation_roles_school_staff";

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_roles_school_staff"
    CHECK (cardinality("roles") >= 1
       AND "roles" <@ ARRAY['teacher', 'hod', 'smt', 'sbst', 'admin']::text[]);
