-- Stage 06 step 5 — the `human_gate` approval task. "A `human_gate` step creates an
-- approval task with the artefact, a diff against the previous version, the evidence
-- used, and the required role."
--
-- Mutable workflow state, the same distinction `orchestrator_run`/`orchestrator_step_run`
-- already draw against a Brain fact: this table does not join `APPEND_ONLY_TABLES` and
-- gets no `app_forbid_mutation()` trigger in the companion RLS migration. The permanent,
-- immutable record that a decision was made is the `audit_event` row `decideHumanGate`
-- also appends in the same transaction, not this row.
--
-- "tenant" carries FORCE ROW LEVEL SECURITY, so the foreign-key validation scan below runs
-- under the tenant policy and fails with 42704 unless a tenant context is set first — the
-- same fix the `brain_write_candidate` and `orchestrator_run` migrations' own headers
-- already explain in full.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "approval_decision" AS ENUM ('APPROVED', 'REJECTED', 'EDITED');

-- CreateTable
CREATE TABLE "approval_task" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "step_id" TEXT NOT NULL,
    "required_role" TEXT NOT NULL,
    "artefact" JSONB NOT NULL,
    "diff_against_previous" JSONB,
    "evidence" JSONB NOT NULL,
    "trace_id" TEXT NOT NULL,
    "decision" "approval_decision",
    "decided_by" UUID,
    "decided_at" TIMESTAMP(3),
    "reason" TEXT,
    "edit_diff" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_task_run_id_step_id_key" ON "approval_task"("run_id", "step_id");

-- CreateIndex
CREATE INDEX "approval_task_tenant_id_idx" ON "approval_task"("tenant_id");

-- CreateIndex
CREATE INDEX "approval_task_tenant_id_decision_idx" ON "approval_task"("tenant_id", "decision");

-- AddForeignKey
ALTER TABLE "approval_task" ADD CONSTRAINT "approval_task_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_task" ADD CONSTRAINT "approval_task_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "orchestrator_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
