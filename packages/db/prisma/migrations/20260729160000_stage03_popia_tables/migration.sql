-- Stage 03 — the POPIA tables: consent ledger, retention schedule, data subject requests.
--
-- ---------------------------------------------------------------------------
-- Why this migration sets a tenant context
-- ---------------------------------------------------------------------------
-- Every table below carries a foreign key to "tenant". Adding a foreign key makes
-- PostgreSQL run a validation scan of the new table joined to the referenced one:
--
--   SELECT fk."tenant_id" FROM ONLY "consent_record" fk
--   LEFT OUTER JOIN ONLY "tenant" pk ON (pk."id" = fk."tenant_id")
--   WHERE pk."id" IS NULL AND fk."tenant_id" IS NOT NULL
--
-- "tenant" carries FORCE ROW LEVEL SECURITY from the Stage 01 migration, so that scan is
-- subject to the tenant policy *even as the table owner* — which is the entire point of
-- FORCE and is not something to work around. The policy reads
-- current_setting('app.tenant_id', false), the raising form, and a migration has no tenant
-- context, so the scan fails with 42704 before it examines a single row. (It fails even
-- though the new table is empty: the setting lookup is row-independent, so the planner
-- hoists it into an InitPlan that runs before the scan yields anything.)
--
-- Stage 01 never hit this because it created every table and its foreign keys *before*
-- enabling RLS. Any migration from here on that adds a tenant-owned table hits it, so this
-- is a pattern rather than a one-off — hence the length of this comment.
--
-- The fix supplies the missing context rather than removing the control. What was
-- considered and rejected:
--
--   * current_setting('app.tenant_id', true) — the non-raising form. This is the one that
--     must never happen. A NULL predicate matches nothing and looks identical to an empty
--     tenant, which is exactly the failure the Stage 01 migration's header warns about.
--   * GRANT BYPASSRLS TO migrator — would silently defeat FORCE everywhere, and would
--     break the isolation suite's assertion that FORCE binds the owner.
--   * SET row_security = off — a role without BYPASSRLS gets an error rather than a
--     bypass, so this does not work and should not be made to.
--   * ALTER TABLE tenant NO FORCE ... then restore — works, but turns the control off,
--     however briefly, in a file someone may later copy.
--
-- Setting the context leaves every policy in force and simply gives the scan the value it
-- requires. The nil UUID matches no tenant, so the join finds nothing on the right; the new
-- tables are empty, so there is nothing on the left either, and the constraint validates
-- against zero rows — which is the truth about a table created three statements ago.
--
-- Plain SET rather than SET LOCAL. Prisma does wrap each migration file in a transaction,
-- which would make SET LOCAL correct — but SET LOCAL outside a transaction block is a
-- warning and a no-op, so that choice would fail silently and identically to having no fix
-- at all if that ever changed. SET works either way, and the RESET at the end of this file
-- puts it back.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "lawful_basis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'SUBJECT_INTEREST', 'PUBLIC_LAW_DUTY', 'LEGITIMATE_INTEREST');

-- CreateEnum
CREATE TYPE "consent_decision" AS ENUM ('GRANTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "consent_source" AS ENUM ('PAPER_FORM', 'GUARDIAN_PORTAL', 'STAFF_CAPTURED', 'MIGRATED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "data_subject_request_kind" AS ENUM ('ACCESS', 'CORRECTION', 'OBJECTION', 'ERASURE', 'PORTABILITY');

-- CreateEnum
CREATE TYPE "data_subject_request_status" AS ENUM ('RECEIVED', 'AWAITING_VERIFICATION', 'IN_PROGRESS', 'FULFILLED', 'REFUSED');

-- CreateTable
CREATE TABLE "consent_record" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_token" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "basis" "lawful_basis" NOT NULL,
    "decision" "consent_decision" NOT NULL,
    "source" "consent_source" NOT NULL,
    "evidence_ref" TEXT,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID,
    "note" TEXT,

    CONSTRAINT "consent_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_rule" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "anchor" TEXT NOT NULL,
    "retain_months" INTEGER NOT NULL,
    "authority" TEXT NOT NULL,
    "ratified_at" TIMESTAMP(3) NOT NULL,
    "ratified_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "retention_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_request" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject_token" TEXT NOT NULL,
    "kind" "data_subject_request_kind" NOT NULL,
    "status" "data_subject_request_status" NOT NULL DEFAULT 'RECEIVED',
    "detail" TEXT NOT NULL,
    "verified_by" UUID,
    "verified_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "outcome" TEXT,
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "data_subject_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_record_tenant_id_idx" ON "consent_record"("tenant_id");

-- CreateIndex
CREATE INDEX "consent_record_tenant_id_subject_token_category_purpose_eff_idx" ON "consent_record"("tenant_id", "subject_token", "category", "purpose", "effective_from");

-- CreateIndex
CREATE INDEX "retention_rule_tenant_id_idx" ON "retention_rule"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "retention_rule_tenant_id_category_key" ON "retention_rule"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "data_subject_request_tenant_id_idx" ON "data_subject_request"("tenant_id");

-- CreateIndex
CREATE INDEX "data_subject_request_tenant_id_status_due_at_idx" ON "data_subject_request"("tenant_id", "status", "due_at");

-- AddForeignKey
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_rule" ADD CONSTRAINT "retention_rule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_request" ADD CONSTRAINT "data_subject_request_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
