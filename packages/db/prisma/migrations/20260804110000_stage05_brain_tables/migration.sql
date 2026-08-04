-- Stage 05 step 1 — the Infinite Brain tables: L0 constitution, L1 semantic (node, edge,
-- embedding), L2 episodic, L3 procedural. L4 working memory has no table — it is a Redis
-- scratchpad, see packages/brain/src/working-memory.ts.
--
-- Every table here carries a foreign key to "tenant", which carries FORCE ROW LEVEL
-- SECURITY from the Stage 01 migration. That makes the foreign-key validation scan
-- itself subject to the tenant policy, even as the table owner — so this migration sets a
-- tenant context before creating anything and resets it once the foreign keys are in
-- place. Full reasoning in the Stage 03 tables migration's header; not repeated here.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "brain_constitution_kind" AS ENUM ('SCHOOL_POLICY', 'CAPS_CANON', 'ATP_CALENDAR', 'TEMPLATE', 'ASSESSMENT_POLICY', 'POPIA_RULE', 'HOUSE_VOICE');

-- CreateEnum
CREATE TYPE "brain_entity_type" AS ENUM ('LEARNER', 'CLASS', 'SUBJECT', 'TOPIC', 'CAPS_CODE', 'ASSESSMENT', 'INTERVENTION', 'RESOURCE', 'STAFF_MEMBER', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "brain_procedure_kind" AS ENUM ('PROMPT_VERSION', 'PIPELINE_DEFINITION', 'SOP', 'EXEMPLAR', 'TOOL_CONTRACT');

-- CreateTable
CREATE TABLE "brain_constitution" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "brain_constitution_kind" NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "supersedes" UUID,
    "ratified_by" UUID NOT NULL,
    "ratified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_constitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_node" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" "brain_entity_type" NOT NULL,
    "external_ref" TEXT,
    "label" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "derivation_run_id" UUID,
    "trace_id" TEXT,
    "supersedes" UUID,
    "tombstoned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_edge" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "relation" TEXT NOT NULL,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "derivation_run_id" UUID,
    "trace_id" TEXT,
    "supersedes" UUID,
    "tombstoned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- "embedding" has no fixed dimension: pgvector accepts an unconstrained vector column,
-- and no embedding model has been chosen for this deployment yet. See the schema's
-- comment on BrainEmbedding for why an invented dimension would be worse than this gap,
-- and docs/STAGE_LOG.md for the follow-up once a model is chosen.
CREATE TABLE "brain_embedding" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "embedding" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_embedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brain_episode" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "subject_node_id" UUID,
    "actor_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "outcome" TEXT,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "derivation_run_id" UUID,
    "trace_id" TEXT,
    "supersedes" UUID,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- "content" for a PROMPT_VERSION row is a pointer (content hash + semver) into
-- packages/prompts, not the prompt text itself — see the schema's comment on
-- BrainProcedure.
CREATE TABLE "brain_procedure" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "brain_procedure_kind" NOT NULL,
    "ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "supersedes" UUID,
    "ratified_by" UUID NOT NULL,
    "ratified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "brain_procedure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brain_constitution_tenant_id_idx" ON "brain_constitution"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_constitution_tenant_id_key_idx" ON "brain_constitution"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "brain_constitution_tenant_id_key_version_key" ON "brain_constitution"("tenant_id", "key", "version");

-- CreateIndex
CREATE INDEX "brain_node_tenant_id_idx" ON "brain_node"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_node_tenant_id_entity_type_idx" ON "brain_node"("tenant_id", "entity_type");

-- CreateIndex
CREATE INDEX "brain_node_tenant_id_external_ref_idx" ON "brain_node"("tenant_id", "external_ref");

-- CreateIndex
CREATE INDEX "brain_edge_tenant_id_idx" ON "brain_edge"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_edge_tenant_id_source_id_idx" ON "brain_edge"("tenant_id", "source_id");

-- CreateIndex
CREATE INDEX "brain_edge_tenant_id_target_id_idx" ON "brain_edge"("tenant_id", "target_id");

-- CreateIndex
CREATE INDEX "brain_edge_tenant_id_relation_idx" ON "brain_edge"("tenant_id", "relation");

-- CreateIndex
CREATE INDEX "brain_embedding_tenant_id_idx" ON "brain_embedding"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "brain_embedding_tenant_id_node_id_model_key" ON "brain_embedding"("tenant_id", "node_id", "model");

-- CreateIndex
CREATE INDEX "brain_episode_tenant_id_idx" ON "brain_episode"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_episode_tenant_id_subject_node_id_occurred_at_idx" ON "brain_episode"("tenant_id", "subject_node_id", "occurred_at");

-- CreateIndex
CREATE INDEX "brain_episode_tenant_id_event_type_occurred_at_idx" ON "brain_episode"("tenant_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "brain_procedure_tenant_id_idx" ON "brain_procedure"("tenant_id");

-- CreateIndex
CREATE INDEX "brain_procedure_tenant_id_kind_ref_idx" ON "brain_procedure"("tenant_id", "kind", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "brain_procedure_tenant_id_kind_ref_version_key" ON "brain_procedure"("tenant_id", "kind", "ref", "version");

-- AddForeignKey
ALTER TABLE "brain_constitution" ADD CONSTRAINT "brain_constitution_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_constitution" ADD CONSTRAINT "brain_constitution_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "brain_constitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_node" ADD CONSTRAINT "brain_node_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_node" ADD CONSTRAINT "brain_node_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "brain_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_edge" ADD CONSTRAINT "brain_edge_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_edge" ADD CONSTRAINT "brain_edge_source_fkey" FOREIGN KEY ("source_id") REFERENCES "brain_node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_edge" ADD CONSTRAINT "brain_edge_target_fkey" FOREIGN KEY ("target_id") REFERENCES "brain_node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_edge" ADD CONSTRAINT "brain_edge_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "brain_edge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_embedding" ADD CONSTRAINT "brain_embedding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_embedding" ADD CONSTRAINT "brain_embedding_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "brain_node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_episode" ADD CONSTRAINT "brain_episode_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_episode" ADD CONSTRAINT "brain_episode_subject_node_id_fkey" FOREIGN KEY ("subject_node_id") REFERENCES "brain_node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_episode" ADD CONSTRAINT "brain_episode_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "brain_episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_procedure" ADD CONSTRAINT "brain_procedure_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brain_procedure" ADD CONSTRAINT "brain_procedure_supersedes_fkey" FOREIGN KEY ("supersedes") REFERENCES "brain_procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The foreign keys are validated; the tenant context that made that possible goes away
-- again here. Nothing below this line may read tenant-owned data.
RESET app.tenant_id;
