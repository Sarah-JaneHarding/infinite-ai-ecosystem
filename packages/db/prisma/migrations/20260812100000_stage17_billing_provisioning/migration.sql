-- Stage 17 — Tenant lifecycle, provisioning, billing
--
-- Adds five new tables:
--   provisioning_record  — onboarding wizard state per tenant (mutable)
--   subscription         — tenant subscription to a billing tier (append-preferred)
--   tenant_metering_event — individual gateway completion/embedding records (append-only)
--   metering_period      — aggregated period totals with reconciliation status (mutable)
--   tenant_invoice       — one invoice per period per subscription (mutable)
--
-- The provisioning_record and subscription tables reference `tenant`, which carries
-- FORCE ROW LEVEL SECURITY. Setting a tenant context first avoids the foreign-key
-- validation scan failing with 42704 (the same fix the Stage 03 and Stage 05 migrations
-- applied — see their headers for the full explanation and the four rejected alternatives).
SET app.tenant_id = '00000000-0000-0000-0000-000000000000';

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "metering_period_status" AS ENUM ('OPEN', 'CLOSED', 'RECONCILED', 'RECONCILIATION_FAILED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateTable: provisioning_record
-- Mutable workflow state — no append-only trigger.
CREATE TABLE "provisioning_record" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "readiness" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "provisioning_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provisioning_record_tenant_id_key" ON "provisioning_record"("tenant_id");
CREATE INDEX "provisioning_record_tenant_id_idx" ON "provisioning_record"("tenant_id");

ALTER TABLE "provisioning_record" ADD CONSTRAINT "provisioning_record_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: subscription
-- Append-preferred (a new row is created on tier change rather than updating the old one).
CREATE TABLE "subscription" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tier_name" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_tenant_id_idx" ON "subscription"("tenant_id");
CREATE INDEX "subscription_tenant_id_status_idx" ON "subscription"("tenant_id", "status");

ALTER TABLE "subscription" ADD CONSTRAINT "subscription_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: tenant_metering_event
-- Append-only ledger of gateway usage records. Trigger enforces immutability.
CREATE TABLE "tenant_metering_event" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_id" TEXT NOT NULL,
    "tokens_used" INTEGER NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_metering_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_metering_event_tenant_id_idx" ON "tenant_metering_event"("tenant_id");
CREATE INDEX "tenant_metering_event_tenant_id_at_idx" ON "tenant_metering_event"("tenant_id", "at");

ALTER TABLE "tenant_metering_event" ADD CONSTRAINT "tenant_metering_event_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Make tenant_metering_event append-only (same pattern as audit_event and consent_record).
CREATE OR REPLACE FUNCTION app_forbid_metering_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'tenant_metering_event rows are append-only (operation: %)', TG_OP;
END;
$$;

CREATE TRIGGER trg_forbid_metering_event_update
    BEFORE UPDATE ON "tenant_metering_event"
    FOR EACH ROW EXECUTE FUNCTION app_forbid_metering_event_mutation();

CREATE TRIGGER trg_forbid_metering_event_delete
    BEFORE DELETE ON "tenant_metering_event"
    FOR EACH ROW EXECUTE FUNCTION app_forbid_metering_event_mutation();

-- CreateTable: metering_period
-- Aggregated period totals. Mutable — status and reconciliation fields change.
CREATE TABLE "metering_period" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "total_cost_cents" INTEGER NOT NULL,
    "learner_count" INTEGER NOT NULL,
    "educator_count" INTEGER NOT NULL,
    "event_count" INTEGER NOT NULL,
    "status" "metering_period_status" NOT NULL DEFAULT 'OPEN',
    "token_deviation_pct" DOUBLE PRECISION,
    "reconciliation_note" TEXT,
    "reconciled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "metering_period_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "metering_period_tenant_id_period_start_period_end_key"
    ON "metering_period"("tenant_id", "period_start", "period_end");
CREATE INDEX "metering_period_tenant_id_idx" ON "metering_period"("tenant_id");
CREATE INDEX "metering_period_tenant_id_status_idx" ON "metering_period"("tenant_id", "status");

ALTER TABLE "metering_period" ADD CONSTRAINT "metering_period_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: tenant_invoice
-- One invoice per subscription period. Mutable — status changes from DRAFT → ISSUED → PAID.
CREATE TABLE "tenant_invoice" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "metering_period_id" UUID,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "subtotal_cents" INTEGER NOT NULL,
    "vat_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "dunning_state" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tenant_invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_invoice_metering_period_id_key" ON "tenant_invoice"("metering_period_id");
CREATE INDEX "tenant_invoice_tenant_id_idx" ON "tenant_invoice"("tenant_id");
CREATE INDEX "tenant_invoice_tenant_id_status_idx" ON "tenant_invoice"("tenant_id", "status");

ALTER TABLE "tenant_invoice" ADD CONSTRAINT "tenant_invoice_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_invoice" ADD CONSTRAINT "tenant_invoice_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON UPDATE CASCADE;

ALTER TABLE "tenant_invoice" ADD CONSTRAINT "tenant_invoice_metering_period_id_fkey"
    FOREIGN KEY ("metering_period_id") REFERENCES "metering_period"("id") ON UPDATE CASCADE;
