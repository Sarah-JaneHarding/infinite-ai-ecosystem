-- Rollback for 20261024090000_oq033_user_invitation and ..._rls (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/user-invitation-rollback.integration.spec.ts. Dropping the table also drops its
-- policy, constraints, indexes and foreign keys. It is destructive only of the invitations
-- themselves — pending invitations are lost, and must be re-issued — and touches no other
-- table: no existing table was altered by the migration, so nothing else needs undoing.
-- Remove the two rows from "_prisma_migrations" afterwards (by migration_name) so a later
-- `prisma migrate deploy` re-applies them rather than believing they ran.

DROP TABLE IF EXISTS "user_invitation";
DROP TYPE IF EXISTS "user_invitation_status";
