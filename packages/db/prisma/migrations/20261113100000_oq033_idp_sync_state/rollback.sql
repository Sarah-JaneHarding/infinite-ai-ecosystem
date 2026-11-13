-- Rollback for 20261113100000_oq033_idp_sync_state (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/idp-sync-state-rollback.integration.spec.ts.
--
-- NOT destructive: dropping these columns would throw away the record of what Keycloak has been told, so
-- the first two statements refuse while any row has left the default (`NOT_MANAGED`, no Keycloak user id,
-- no error kind). The guard is a temporary CHECK rather than a SELECT: both tables are FORCE ROW LEVEL
-- SECURITY, so a SELECT run as the migrator without a tenant context raises, whereas the validation scan
-- that ADD CONSTRAINT runs sees every row. Everything runs in one transaction, so a refusal leaves the
-- schema exactly as it was. Remove this migration's row from "_prisma_migrations" (by migration_name)
-- afterwards so a later `prisma migrate deploy` re-applies it.

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_idp_unused"
    CHECK ("idp_state" = 'NOT_MANAGED' AND "idp_user_id" IS NULL AND "idp_error_kind" IS NULL);
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_idp_unused"
    CHECK ("idp_state" = 'NOT_MANAGED' AND "idp_error_kind" IS NULL);

ALTER TABLE "user_invitation" DROP CONSTRAINT "user_invitation_idp_consistent";
ALTER TABLE "user_account" DROP CONSTRAINT "user_account_idp_consistent";

ALTER TABLE "user_invitation"
    DROP COLUMN "idp_state",
    DROP COLUMN "idp_user_id",
    DROP COLUMN "idp_error_kind";

ALTER TABLE "user_account"
    DROP COLUMN "idp_state",
    DROP COLUMN "idp_error_kind";

DROP TYPE "idp_state";
