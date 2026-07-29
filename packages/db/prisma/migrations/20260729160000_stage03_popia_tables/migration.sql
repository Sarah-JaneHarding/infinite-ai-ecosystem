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

