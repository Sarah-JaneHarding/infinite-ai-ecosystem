-- Stage 06 step 9 — the Run Inspector's own required fields on "orchestrator_step_run":
-- tokens, cost, retrieved context and guardrail verdicts, alongside the input/output/
-- error/timestamps the table already carried. All four nullable and populated only on a
-- SUCCEEDED outcome, via an injected `RunnerOptions.collectStepTelemetry` — see this
-- table's own schema comment and `docs/STAGE_LOG.md`'s step 9 entry for why an attempt
-- that fails before reporting usage has nothing recorded here, a stated scope boundary.
--
-- A plain ALTER TABLE ADD COLUMN, unlike the CREATE TABLE migrations elsewhere in this
-- stage: no foreign key is being validated here, so none of the FORCE ROW LEVEL SECURITY
-- tenant-context wrapper those migrations need applies to this one.

ALTER TABLE "orchestrator_step_run" ADD COLUMN "tokens_used" INTEGER;
ALTER TABLE "orchestrator_step_run" ADD COLUMN "cost_usd" DOUBLE PRECISION;
ALTER TABLE "orchestrator_step_run" ADD COLUMN "retrieved_context" JSONB;
ALTER TABLE "orchestrator_step_run" ADD COLUMN "guardrail_verdicts" JSONB;
