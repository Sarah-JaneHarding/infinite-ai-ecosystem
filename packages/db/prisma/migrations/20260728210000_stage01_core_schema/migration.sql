-- NOTE: Prisma emits `CREATE SCHEMA IF NOT EXISTS "public"` here. It is deliberately
-- removed. That statement requires CREATE on the *database*, which `migrator` does not
-- have and should not be given: its job is to create tables in an existing schema, not
-- schemas in the database (§1.3, least privilege). `public` always exists, so the
-- statement is pure privilege escalation for no benefit. Postgres checks the privilege
-- before the IF NOT EXISTS short-circuit, so it fails even though the schema is there.
--
-- If a future `prisma migrate diff` reintroduces it, delete it again. A test in
-- test/schema-classification.spec.ts fails if any migration contains CREATE SCHEMA.

-- CreateEnum
CREATE TYPE "tenant_kind" AS ENUM ('SCHOOL', 'SCHOOL_GROUP');

-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "learner_status" AS ENUM ('ENROLLED', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "identifier_kind" AS ENUM ('NATIONAL_ID', 'SASAMS_NUMBER', 'LEGAL_NAME', 'DATE_OF_BIRTH');

-- CreateEnum
CREATE TYPE "staff_status" AS ENUM ('ACTIVE', 'ON_LEAVE', 'DEPARTED');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "tenant_kind" NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'af-south-1',
    "status" "tenant_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_setting" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_account_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "school_id" UUID,
    "class_group_id" UUID,
    "subject_id" UUID,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "emis_number" TEXT,
    "lolt" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "school_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phase" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "phase_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "caps_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_group" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "class_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_year" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "academic_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "term" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "class_group_id" UUID,
    "token" TEXT NOT NULL,
    "home_language" TEXT,
    "status" "learner_status" NOT NULL DEFAULT 'ENROLLED',
    "tombstoned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_identifier" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "kind" "identifier_kind" NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "key_version" INTEGER NOT NULL,
    "lookup_hash" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "learner_identifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "home_language" TEXT,
    "tombstoned_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_link" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "may_receive_reports" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "guardian_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_member" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "user_account_id" UUID,
    "sace_number" TEXT,
    "display_name" TEXT NOT NULL,
    "status" "staff_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "staff_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignment" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "class_group_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "teaching_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "purpose" TEXT,
    "trace_id" TEXT,
    "diff" JSONB,
    "previous_hash" BYTEA,
    "hash" BYTEA NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "tenant_setting_tenant_id_idx" ON "tenant_setting"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_setting_tenant_id_key_key" ON "tenant_setting"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "user_account_tenant_id_idx" ON "user_account"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_tenant_id_subject_key" ON "user_account"("tenant_id", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_tenant_id_email_key" ON "user_account"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "role_assignment_tenant_id_idx" ON "role_assignment"("tenant_id");

-- CreateIndex
CREATE INDEX "role_assignment_tenant_id_user_account_id_idx" ON "role_assignment"("tenant_id", "user_account_id");

-- CreateIndex
CREATE INDEX "school_tenant_id_idx" ON "school"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_tenant_id_name_key" ON "school"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "phase_tenant_id_idx" ON "phase"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "phase_tenant_id_school_id_name_key" ON "phase"("tenant_id", "school_id", "name");

-- CreateIndex
CREATE INDEX "grade_tenant_id_idx" ON "grade"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_tenant_id_phase_id_label_key" ON "grade"("tenant_id", "phase_id", "label");

-- CreateIndex
CREATE INDEX "subject_tenant_id_idx" ON "subject"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_tenant_id_name_key" ON "subject"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "class_group_tenant_id_idx" ON "class_group"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_group_tenant_id_school_id_name_key" ON "class_group"("tenant_id", "school_id", "name");

-- CreateIndex
CREATE INDEX "academic_year_tenant_id_idx" ON "academic_year"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_year_tenant_id_school_id_year_key" ON "academic_year"("tenant_id", "school_id", "year");

-- CreateIndex
CREATE INDEX "term_tenant_id_idx" ON "term"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "term_tenant_id_academic_year_id_number_key" ON "term"("tenant_id", "academic_year_id", "number");

-- CreateIndex
CREATE INDEX "learner_tenant_id_idx" ON "learner"("tenant_id");

-- CreateIndex
CREATE INDEX "learner_tenant_id_school_id_grade_id_idx" ON "learner"("tenant_id", "school_id", "grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_tenant_id_token_key" ON "learner"("tenant_id", "token");

-- CreateIndex
CREATE INDEX "learner_identifier_tenant_id_idx" ON "learner_identifier"("tenant_id");

-- CreateIndex
CREATE INDEX "learner_identifier_tenant_id_kind_lookup_hash_idx" ON "learner_identifier"("tenant_id", "kind", "lookup_hash");

-- CreateIndex
CREATE UNIQUE INDEX "learner_identifier_tenant_id_learner_id_kind_key" ON "learner_identifier"("tenant_id", "learner_id", "kind");

-- CreateIndex
CREATE INDEX "guardian_tenant_id_idx" ON "guardian"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_tenant_id_token_key" ON "guardian"("tenant_id", "token");

-- CreateIndex
CREATE INDEX "guardian_link_tenant_id_idx" ON "guardian_link"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_link_tenant_id_guardian_id_learner_id_key" ON "guardian_link"("tenant_id", "guardian_id", "learner_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_member_user_account_id_key" ON "staff_member"("user_account_id");

-- CreateIndex
CREATE INDEX "staff_member_tenant_id_idx" ON "staff_member"("tenant_id");

-- CreateIndex
CREATE INDEX "teaching_assignment_tenant_id_idx" ON "teaching_assignment"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_assignment_tenant_id_staff_member_id_class_group_i_key" ON "teaching_assignment"("tenant_id", "staff_member_id", "class_group_id", "subject_id");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_idx" ON "audit_event"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_at_idx" ON "audit_event"("tenant_id", "at");

-- CreateIndex
CREATE INDEX "audit_event_tenant_id_resource_type_resource_id_idx" ON "audit_event"("tenant_id", "resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "tenant_setting" ADD CONSTRAINT "tenant_setting_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account" ADD CONSTRAINT "user_account_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school" ADD CONSTRAINT "school_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase" ADD CONSTRAINT "phase_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phase" ADD CONSTRAINT "phase_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade" ADD CONSTRAINT "grade_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade" ADD CONSTRAINT "grade_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_group" ADD CONSTRAINT "class_group_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term" ADD CONSTRAINT "term_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "term" ADD CONSTRAINT "term_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_year"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner" ADD CONSTRAINT "learner_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner" ADD CONSTRAINT "learner_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner" ADD CONSTRAINT "learner_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner" ADD CONSTRAINT "learner_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_identifier" ADD CONSTRAINT "learner_identifier_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_identifier" ADD CONSTRAINT "learner_identifier_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_link" ADD CONSTRAINT "guardian_link_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_member" ADD CONSTRAINT "staff_member_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignment" ADD CONSTRAINT "teaching_assignment_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

