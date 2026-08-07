-- Stage 09 step 1 — the MOD-03 Data Collection & Warehouse tables.
--
-- Eight new tables: ingest_source, ingest_run, raw_ingest_record, domain_event_log,
-- source_field_mapping, ingest_quality_report, learner_360, and screening_feature.
-- All carry tenant_id and are isolated by the standard RLS policy in the companion
-- migration (20260807080100_stage09_warehouse_rls).
--
-- "tenant" carries FORCE ROW LEVEL SECURITY, so the foreign-key validation scan below
-- runs under the tenant policy and fails with 42704 unless a tenant context is set first.
-- The same fix the Stage 03, 05 and 06 migrations each applied.
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "connector_kind" AS ENUM (
  'FILE_CSV',
  'FILE_XLSX',
  'SIS_API',
  'SCREENER_API',
  'ATTENDANCE_API',
  'BEHAVIOUR_API',
  'MANUAL_UPLOAD'
);

-- CreateEnum
CREATE TYPE "ingest_source_status" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "ingest_run_status" AS ENUM (
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIALLY_SUCCEEDED',
  'QUARANTINED'
);

-- CreateEnum
CREATE TYPE "data_domain" AS ENUM (
  'ATTENDANCE',
  'ASSESSMENT',
  'BEHAVIOUR',
  'WELLBEING',
  'DEMOGRAPHIC',
  'SCREENER'
);

-- CreateTable
CREATE TABLE "ingest_source" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "connector_kind" "connector_kind" NOT NULL,
    "config_ref" TEXT NOT NULL,
    "schedule" TEXT,
    "status" "ingest_source_status" NOT NULL DEFAULT 'ACTIVE',
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ingest_source_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingest_source_tenant_id_idx" ON "ingest_source"("tenant_id");

-- CreateTable
CREATE TABLE "ingest_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "connector_kind" "connector_kind" NOT NULL,
    "status" "ingest_run_status" NOT NULL,
    "records_received" INTEGER,
    "records_conformed" INTEGER,
    "records_rejected" INTEGER,
    "error_detail" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ingest_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingest_run_tenant_id_idx" ON "ingest_run"("tenant_id");
CREATE INDEX "ingest_run_tenant_id_source_id_idx" ON "ingest_run"("tenant_id", "source_id");

-- CreateTable
CREATE TABLE "raw_ingest_record" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ingest_run_id" UUID NOT NULL,
    "source_ref" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "schema_version" TEXT,
    "conformed_at" TIMESTAMP(3),
    "conformed_id" UUID,
    "rejected_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_ingest_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_ingest_record_tenant_id_idx" ON "raw_ingest_record"("tenant_id");
CREATE INDEX "raw_ingest_record_tenant_id_ingest_run_id_idx" ON "raw_ingest_record"("tenant_id", "ingest_run_id");

-- CreateTable
CREATE TABLE "domain_event_log" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "domain" "data_domain" NOT NULL,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "raw_record_id" UUID,
    "source_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "domain_event_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_event_log_tenant_id_idx" ON "domain_event_log"("tenant_id");
CREATE INDEX "domain_event_log_tenant_id_learner_id_idx" ON "domain_event_log"("tenant_id", "learner_id");
CREATE INDEX "domain_event_log_tenant_id_domain_idx" ON "domain_event_log"("tenant_id", "domain");

-- CreateTable
CREATE TABLE "source_field_mapping" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "connector_kind" "connector_kind" NOT NULL,
    "source_field" TEXT NOT NULL,
    "canonical_field" TEXT NOT NULL,
    "transform_fn" TEXT,
    "human_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "source_field_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_field_mapping_tenant_id_connector_kind_source_field_key"
  ON "source_field_mapping"("tenant_id", "connector_kind", "source_field");
CREATE INDEX "source_field_mapping_tenant_id_idx" ON "source_field_mapping"("tenant_id");

-- CreateTable
CREATE TABLE "ingest_quality_report" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ingest_run_id" UUID NOT NULL,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "issues" JSONB NOT NULL,
    "blocked_downstream" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "ingest_quality_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingest_quality_report_ingest_run_id_key" ON "ingest_quality_report"("ingest_run_id");
CREATE INDEX "ingest_quality_report_tenant_id_idx" ON "ingest_quality_report"("tenant_id");

-- CreateTable
CREATE TABLE "learner_360" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "attendance_summary" JSONB,
    "academic_summary" JSONB,
    "behaviour_summary" JSONB,
    "wellbeing_summary" JSONB,
    "screener_results" JSONB,
    "data_quality_note" TEXT,
    "last_materialised_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "learner_360_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learner_360_learner_id_key" ON "learner_360"("learner_id");
CREATE INDEX "learner_360_tenant_id_idx" ON "learner_360"("tenant_id");

-- CreateTable
CREATE TABLE "screening_feature" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "feature_name" TEXT NOT NULL,
    "feature_value" DOUBLE PRECISION NOT NULL,
    "as_at" TIMESTAMP(3) NOT NULL,
    "source_run_id" UUID,
    "supersedes" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_feature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "screening_feature_tenant_id_idx" ON "screening_feature"("tenant_id");
CREATE INDEX "screening_feature_tenant_id_learner_id_idx" ON "screening_feature"("tenant_id", "learner_id");
CREATE INDEX "screening_feature_tenant_id_learner_id_feature_name_as_at_idx"
  ON "screening_feature"("tenant_id", "learner_id", "feature_name", "as_at" DESC);

-- AddForeignKey
ALTER TABLE "ingest_source" ADD CONSTRAINT "ingest_source_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_run" ADD CONSTRAINT "ingest_run_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_run" ADD CONSTRAINT "ingest_run_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "ingest_source"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_ingest_record" ADD CONSTRAINT "raw_ingest_record_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_ingest_record" ADD CONSTRAINT "raw_ingest_record_ingest_run_id_fkey"
  FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_run"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_event_log" ADD CONSTRAINT "domain_event_log_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_event_log" ADD CONSTRAINT "domain_event_log_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_field_mapping" ADD CONSTRAINT "source_field_mapping_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_quality_report" ADD CONSTRAINT "ingest_quality_report_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_quality_report" ADD CONSTRAINT "ingest_quality_report_ingest_run_id_fkey"
  FOREIGN KEY ("ingest_run_id") REFERENCES "ingest_run"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_360" ADD CONSTRAINT "learner_360_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_360" ADD CONSTRAINT "learner_360_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_feature" ADD CONSTRAINT "screening_feature_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_feature" ADD CONSTRAINT "screening_feature_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON UPDATE CASCADE;
