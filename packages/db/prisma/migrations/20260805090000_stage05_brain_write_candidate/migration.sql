-- Stage 05 step 2 — the write path's own table: one row per fact travelling through
-- `candidate → extracted+typed → contradiction-checked → provenance-stamped →
-- (ratify if L0/L3) → committed+versioned → indexed → retention-scheduled`.
--
-- Unlike the six tables Stage 05 step 1 added, this one is mutable — it is workflow
-- state, not a Brain fact, the same distinction `data_subject_request` draws against
-- `consent_record`. It does not join `APPEND_ONLY_TABLES` and gets no
-- `app_forbid_mutation()` trigger in the companion RLS migration.
--
-- This table's foreign key to "retention_rule" carries FORCE ROW LEVEL SECURITY from the
-- Stage 03 migration, which makes the foreign-key validation scan below subject to the
-- tenant policy even as the table owner — the same reason the Stage 03 and Stage 05 step 1
-- migrations set a tenant context first. Full reasoning in the Stage 03 tables migration's
-- header; not repeated here.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "brain_target_tier" AS ENUM ('L0_CONSTITUTION', 'L1_NODE', 'L1_EDGE', 'L2_EPISODE', 'L3_PROCEDURE');

-- CreateEnum
CREATE TYPE "brain_write_status" AS ENUM ('CANDIDATE', 'EXTRACTED', 'CONTRADICTION_CHECKED', 'PROVENANCE_STAMPED', 'AWAITING_RATIFICATION', 'COMMITTED', 'INDEXED', 'RETENTION_SCHEDULED');

-- CreateTable
CREATE TABLE "brain_write_candidate" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_tier" "brain_target_tier" NOT NULL,
    "status" "brain_write_status" NOT NULL DEFAULT 'CANDIDATE',
    "raw_payload" JSONB NOT NULL,
    "typed_payload" JSONB,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "derivation_run_id" UUID,
    "trace_id" TEXT,
    "contradiction_of" UUID,
    "ratified_by" UUID,
    "ratified_at" TIMESTAMP(3),
    "committed_row_id" UUID,
    "committed_version" INTEGER,
    "retention_category" TEXT,
    "retention_rule_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "brain_write_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brain_write_candidate_tenant_id_idx" ON "brain_write_candidate"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_write_candidate_tenant_id_status_idx" ON "brain_write_candidate"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "brain_write_candidate_tenant_id_target_tier_idx" ON "brain_write_candidate"("tenant_id", "target_tier");

-- AddForeignKey
ALTER TABLE "brain_write_candidate" ADD CONSTRAINT "brain_write_candidate_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_write_candidate" ADD CONSTRAINT "brain_write_candidate_retention_rule_id_fkey" FOREIGN KEY ("retention_rule_id") REFERENCES "retention_rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
