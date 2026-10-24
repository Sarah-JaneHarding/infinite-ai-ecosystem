-- OQ-033 step 1 — the invitation table (docs/PROVISIONING_DESIGN.md §4.1).
--
-- An administrator invites a named person to join the school with a list of roles. First
-- sign-in later links a verified identity to a PENDING invitation; nothing in this table is
-- authority by itself, and nothing here is built on yet (steps 2-8 of the delivery plan).
--
-- This migration references "tenant", "school", "staff_member" and "user_account". "tenant"
-- carries FORCE ROW LEVEL SECURITY, so adding a foreign key to it makes PostgreSQL run a
-- validation scan that fails with 42704 unless a tenant context is set. The fix is the one
-- the Stage 03, 05 and 17 migrations applied — see the header of
-- 20260729160000_stage03_popia_tables for the full explanation and the four rejected
-- alternatives. The nil UUID matches no tenant; the new table is empty; the scan validates
-- against zero rows, which is the truth about a table created a few statements ago.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "user_invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user_invitation" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roles" TEXT[],
    "school_id" UUID,
    "staff_member_id" UUID,
    "status" "user_invitation_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_account_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_invitation_pkey" PRIMARY KEY ("id"),

    -- Matching is exact after normalisation, never fuzzy: the address is stored trimmed and
    -- lower-case, so the sign-in lookup compares like with like and a lookalike cannot match.
    CONSTRAINT "user_invitation_email_normalised"
        CHECK ("email" = lower(btrim("email")) AND position('@' in "email") > 1),

    -- At least one role, and only school staff roles. A platform role (or a guardian or
    -- learner, which need their own designs) can never be granted by an invitation, whoever
    -- writes the row — the same guard-rail the application enforces, held at the data layer.
    CONSTRAINT "user_invitation_roles_school_staff"
        CHECK (cardinality("roles") >= 1
           AND "roles" <@ ARRAY['teacher', 'hod', 'smt', 'sbst', 'admin']::text[]),

    -- ACCEPTED if and only if there is an acceptance time and the account it created.
    CONSTRAINT "user_invitation_accepted_consistent"
        CHECK (("status" = 'ACCEPTED') = ("accepted_at" IS NOT NULL AND "accepted_account_id" IS NOT NULL)
           AND (("accepted_at" IS NULL) = ("accepted_account_id" IS NULL)))
);

-- An account is created from at most one invitation.
CREATE UNIQUE INDEX "user_invitation_accepted_account_id_key" ON "user_invitation"("accepted_account_id");

-- One live invitation per address per school. Partial (not expressible in the Prisma schema):
-- a REVOKED or EXPIRED invitation does not block inviting the same person again.
CREATE UNIQUE INDEX "user_invitation_pending_email_key"
    ON "user_invitation"("tenant_id", "email") WHERE "status" = 'PENDING';

CREATE INDEX "user_invitation_tenant_id_idx" ON "user_invitation"("tenant_id");
CREATE INDEX "user_invitation_tenant_id_status_idx" ON "user_invitation"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_staff_member_id_fkey"
    FOREIGN KEY ("staff_member_id") REFERENCES "staff_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_accepted_account_id_fkey"
    FOREIGN KEY ("accepted_account_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

RESET app.tenant_id;
