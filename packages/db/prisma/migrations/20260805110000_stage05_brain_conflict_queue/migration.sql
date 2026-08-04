-- Stage 05 step 3 — contradiction resolution: `brain_write_candidate` gains a verdict
-- column, and `brain_conflict_queue` gains a table. See the schema's own comment on
-- `BrainConflictStatus` for why only `L1_NODE`/`L1_EDGE` ever populate the queue.
--
-- This table's foreign key to "brain_write_candidate" carries FORCE ROW LEVEL SECURITY
-- (Stage 05 step 2), which makes the foreign-key validation scan below subject to the
-- tenant policy even as the table owner — the same reason every migration since Stage 03
-- sets a tenant context first. Full reasoning in the Stage 03 tables migration's header;
-- not repeated here.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "brain_conflict_status" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "brain_conflict_resolution" AS ENUM ('ACCEPT_NEW', 'KEEP_EXISTING');

-- AlterTable
ALTER TABLE "brain_write_candidate" ADD COLUMN     "contradiction_resolution" "brain_conflict_resolution";

-- CreateTable
CREATE TABLE "brain_conflict_queue" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "write_candidate_id" UUID NOT NULL,
    "target_tier" "brain_target_tier" NOT NULL,
    "contradiction_of" UUID NOT NULL,
    "new_confidence" DOUBLE PRECISION NOT NULL,
    "existing_confidence" DOUBLE PRECISION NOT NULL,
    "new_recency" TIMESTAMP(3) NOT NULL,
    "existing_recency" TIMESTAMP(3) NOT NULL,
    "status" "brain_conflict_status" NOT NULL DEFAULT 'OPEN',
    "resolution" "brain_conflict_resolution",
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "brain_conflict_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brain_conflict_queue_write_candidate_id_key" ON "brain_conflict_queue"("write_candidate_id");

-- CreateIndex
CREATE INDEX "brain_conflict_queue_tenant_id_idx" ON "brain_conflict_queue"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_conflict_queue_tenant_id_status_idx" ON "brain_conflict_queue"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "brain_conflict_queue" ADD CONSTRAINT "brain_conflict_queue_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_conflict_queue" ADD CONSTRAINT "brain_conflict_queue_write_candidate_id_fkey" FOREIGN KEY ("write_candidate_id") REFERENCES "brain_write_candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
