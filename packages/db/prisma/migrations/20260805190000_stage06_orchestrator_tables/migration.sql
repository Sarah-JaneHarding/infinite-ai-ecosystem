-- Stage 06 step 4 — the DAG orchestrator's own tables: one row per run, one row per step
-- attempt. "The runner must provide durability (state persisted per step)... and
-- resumability."
--
-- Both tables are mutable workflow state, the same distinction `brain_write_candidate`'s
-- own migration already draws against a Brain fact: neither joins `APPEND_ONLY_TABLES`,
-- and neither gets the `app_forbid_mutation()` trigger in the companion RLS migration.
--
-- "tenant" carries FORCE ROW LEVEL SECURITY, so the foreign-key validation scan below runs
-- under the tenant policy and fails with 42704 unless a tenant context is set first — the
-- same fix the `brain_write_candidate` migration's own header explains in full.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "orchestrator_run_status" AS ENUM ('PENDING', 'RUNNING', 'WAITING_FOR_APPROVAL', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'COMPENSATING', 'COMPENSATED');

-- CreateEnum
CREATE TYPE "orchestrator_step_run_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRY_SCHEDULED', 'TIMED_OUT', 'CANCELLED', 'SKIPPED');

-- CreateTable
CREATE TABLE "orchestrator_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "pipeline_version" TEXT NOT NULL,
    "status" "orchestrator_run_status" NOT NULL DEFAULT 'PENDING',
    "trace_id" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "current_step_id" TEXT,
    "succeeded_step_ids" JSONB NOT NULL DEFAULT '[]',
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "orchestrator_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestrator_step_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "step_id" TEXT NOT NULL,
    "status" "orchestrator_step_run_status" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orchestrator_step_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orchestrator_run_tenant_id_idx" ON "orchestrator_run"("tenant_id");

-- CreateIndex
CREATE INDEX "orchestrator_run_tenant_id_status_idx" ON "orchestrator_run"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orchestrator_step_run_run_id_step_id_attempt_key" ON "orchestrator_step_run"("run_id", "step_id", "attempt");

-- CreateIndex
CREATE INDEX "orchestrator_step_run_tenant_id_idx" ON "orchestrator_step_run"("tenant_id");

-- CreateIndex
CREATE INDEX "orchestrator_step_run_tenant_id_run_id_idx" ON "orchestrator_step_run"("tenant_id", "run_id");

-- AddForeignKey
ALTER TABLE "orchestrator_run" ADD CONSTRAINT "orchestrator_run_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchestrator_step_run" ADD CONSTRAINT "orchestrator_step_run_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchestrator_step_run" ADD CONSTRAINT "orchestrator_step_run_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "orchestrator_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
