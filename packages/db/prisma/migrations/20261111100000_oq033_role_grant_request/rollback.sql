-- Rollback for 20261111100000_oq033_role_grant_request and ..._rls (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/role-grant-request-rollback.integration.spec.ts. Dropping the table also drops its policy,
-- constraints, indexes and foreign keys. It is destructive only of the requests themselves —
-- pending requests are lost, and must be proposed again — and touches no other table: no existing
-- table was altered by the migration, and any grant a request already applied lives in
-- "role_assignment", which is left exactly as it is.
-- Remove the two rows from "_prisma_migrations" afterwards (by migration_name) so a later
-- `prisma migrate deploy` re-applies them rather than believing they ran.

DROP TABLE IF EXISTS "role_grant_request";
DROP TYPE IF EXISTS "role_grant_request_status";
