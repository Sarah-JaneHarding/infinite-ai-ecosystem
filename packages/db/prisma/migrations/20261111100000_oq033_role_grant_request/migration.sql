-- OQ-033 step 3b — the stored request for granting admin or smt to an existing account
-- (docs/PROVISIONING_DESIGN.md §4.7).
--
-- When a school has two or more administrators, giving an EXISTING account `admin` or `smt` needs a
-- second administrator's confirmation. A confirmation the caller merely asserts is no confirmation,
-- so the proposal is a durable act by the first administrator and the confirmation a separate one
-- by the second. Confirming applies the grant in the same transaction (there is no "confirmed but
-- not yet applied" state). A school with a single administrator has no one to confirm, so that
-- grant is applied at once and the waiver is recorded in the audit ledger; no row is written here.
--
-- Differences from the §4.7 text, recorded rather than silent: `decided_by` / `decided_at` are
-- also set when a request is CANCELLED (whoever cancelled it — the proposer included), because the
-- audit trail of who withdrew it belongs on the row. The two-person CHECK applies only to the
-- outcomes that need a second person: APPLIED and DECLINED.
--
-- References "tenant", "school" and "user_account". "tenant" carries FORCE ROW LEVEL SECURITY, so
-- adding a foreign key to it makes PostgreSQL run a validation scan that fails with 42704 unless a
-- tenant context is set. The fix is the one the Stage 03, 05 and 17 migrations applied — see the
-- header of 20260729160000_stage03_popia_tables. The nil UUID matches no tenant; the new table is
-- empty, so the scan validates against zero rows.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "role_grant_request_status" AS ENUM ('PENDING', 'APPLIED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "role_grant_request" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "roles" TEXT[],
    "school_id" UUID,
    "requested_by" UUID NOT NULL,
    "status" "role_grant_request_status" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_grant_request_pkey" PRIMARY KEY ("id"),

    -- At least one role, and only the two that need a second administrator. Anything else is
    -- granted by one administrator directly and never needs a request. The explicit IS NOT NULL
    -- matters: a CHECK that evaluates to NULL passes, and the column is nullable (as Prisma
    -- generates list columns), so without it a NULL would skip the other two tests entirely.
    CONSTRAINT "role_grant_request_roles_sensitive"
        CHECK ("roles" IS NOT NULL
           AND cardinality("roles") >= 1
           AND "roles" <@ ARRAY['admin', 'smt']::text[]),

    -- Nobody proposes roles for themselves.
    CONSTRAINT "role_grant_request_not_self"
        CHECK ("target_account_id" <> "requested_by"),

    -- A decision is recorded as a pair, and only for the outcomes that have a decider.
    CONSTRAINT "role_grant_request_decision_consistent"
        CHECK (("status" IN ('APPLIED', 'DECLINED', 'CANCELLED')) = ("decided_by" IS NOT NULL)
           AND (("decided_by" IS NULL) = ("decided_at" IS NULL))),

    -- The two-person rule, in the data: whoever applies or declines is neither the person who
    -- proposed it nor the person who would receive the roles. A bug in a caller cannot record a
    -- self-confirmed grant.
    CONSTRAINT "role_grant_request_two_person"
        CHECK ("status" NOT IN ('APPLIED', 'DECLINED')
           OR ("decided_by" <> "requested_by" AND "decided_by" <> "target_account_id"))
);

-- One live request per target account. Partial (not expressible in the Prisma schema): a
-- finished request does not block proposing again.
CREATE UNIQUE INDEX "role_grant_request_pending_target_key"
    ON "role_grant_request"("tenant_id", "target_account_id") WHERE "status" = 'PENDING';

CREATE INDEX "role_grant_request_tenant_id_idx" ON "role_grant_request"("tenant_id");
CREATE INDEX "role_grant_request_tenant_id_status_idx" ON "role_grant_request"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "role_grant_request" ADD CONSTRAINT "role_grant_request_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_grant_request" ADD CONSTRAINT "role_grant_request_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_grant_request" ADD CONSTRAINT "role_grant_request_target_account_id_fkey"
    FOREIGN KEY ("target_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_grant_request" ADD CONSTRAINT "role_grant_request_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "user_account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "role_grant_request" ADD CONSTRAINT "role_grant_request_decided_by_fkey"
    FOREIGN KEY ("decided_by") REFERENCES "user_account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

RESET app.tenant_id;
