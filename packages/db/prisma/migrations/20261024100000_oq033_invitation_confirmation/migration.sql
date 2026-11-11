-- OQ-033 step 3 — the second administrator's confirmation, persisted on the invitation.
--
-- Granting `admin` or `smt` needs a second administrator's confirmation when the school has two
-- or more (docs/PROVISIONING_DESIGN.md §12.1). A confirmation that the caller merely asserts is no
-- confirmation, so it has to be a recorded act by the second administrator themselves: the
-- invitation is created AWAITING, the second administrator confirms it as themselves, and only
-- then can it be accepted. A school with a single administrator cannot be confirmed by anyone,
-- so its invitation is WAIVED_SOLE_ADMIN — recorded, not silent.
--
-- Adds two columns to "user_invitation" (an empty table in every environment until step 3 ships;
-- the default keeps any existing row valid). The new foreign key to "user_account" makes
-- PostgreSQL run a validation scan of that tenant-owned table under FORCE ROW LEVEL SECURITY, which
-- fails with 42704 without a tenant context — the same fix, and the same reasoning, as in
-- 20261024090000_oq033_user_invitation and the Stage 03/05/17 migrations.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "invitation_confirmation" AS ENUM ('NOT_REQUIRED', 'AWAITING', 'CONFIRMED', 'WAIVED_SOLE_ADMIN');

-- AlterTable
ALTER TABLE "user_invitation"
    ADD COLUMN "confirmation" "invitation_confirmation" NOT NULL DEFAULT 'NOT_REQUIRED',
    ADD COLUMN "confirmed_by" UUID;

-- CONFIRMED if and only if there is a confirming administrator.
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_confirmed_consistent"
    CHECK (("confirmation" = 'CONFIRMED') = ("confirmed_by" IS NOT NULL));

-- An invitation still awaiting confirmation can never have been accepted, whoever writes the row.
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_accepted_not_awaiting"
    CHECK ("status" <> 'ACCEPTED' OR "confirmation" <> 'AWAITING');

-- AddForeignKey
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_confirmed_by_fkey"
    FOREIGN KEY ("confirmed_by") REFERENCES "user_account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

RESET app.tenant_id;
