-- Rollback for 20261024100000_oq033_invitation_confirmation (rule 10).
--
-- Not applied by Prisma: run by hand as the migrator, and exercised by
-- test/user-invitation-rollback.integration.spec.ts. Dropping the columns drops the two CHECK
-- constraints and the foreign key with them. It loses only the confirmation state: an invitation
-- that was AWAITING becomes indistinguishable from one that needs none, so roll back only with no
-- AWAITING invitations outstanding (the migration's own header says why that state matters).
-- Remove its row from "_prisma_migrations" afterwards (by migration_name).

ALTER TABLE "user_invitation" DROP COLUMN IF EXISTS "confirmed_by";
ALTER TABLE "user_invitation" DROP COLUMN IF EXISTS "confirmation";
DROP TYPE IF EXISTS "invitation_confirmation";
