-- Stage 09 step 8 — De-identified analytics views for the analytics_ro role.
--
-- The analytics_ro role must never see a base table.  This migration creates three
-- read-only views that strip or pseudonymise every direct learner identifier, then
-- grants SELECT on those views — and only those views — to analytics_ro.
--
-- Underlying tables carry FORCE ROW LEVEL SECURITY; the views inherit those policies
-- so analytics_ro still sees only the current tenant's data (caller must set
-- app.tenant_id before querying, exactly as app_rw does).
--
-- Pseudonymisation strategy:
--   learner_id UUID → encode(digest(learner_id::text, 'sha256'), 'hex')
--   SHA-256 via pgcrypto (already installed in Stage 01).
--   Consistent across queries within a tenant; not reversible without the source table.
--   payload JSONB is excluded entirely — it may contain raw source values.
--
-- Three views:
--   v_analytics_ingest_run        — ingest run statistics, no learner data
--   v_analytics_quality_report    — quality scores per run, no learner data
--   v_analytics_domain_event      — per-event metadata, learner pseudonymised

-- ---------------------------------------------------------------------------
-- v_analytics_ingest_run
-- ---------------------------------------------------------------------------
-- One row per ingest run; all fields are operational metadata with no learner PII.

CREATE VIEW v_analytics_ingest_run AS
SELECT
    ir.id                                          AS run_id,
    ir.tenant_id,
    ir.source_id,
    ir.connector_kind,
    ir.status,
    ir.records_received,
    ir.records_conformed,
    ir.records_rejected,
    date_trunc('day', ir.started_at)               AS started_day,
    date_trunc('day', ir.completed_at)             AS completed_day
FROM ingest_run ir;

-- ---------------------------------------------------------------------------
-- v_analytics_quality_report
-- ---------------------------------------------------------------------------
-- One row per quality report; quality score and blocking flag, no learner data.

CREATE VIEW v_analytics_quality_report AS
SELECT
    iqr.id                                         AS report_id,
    iqr.tenant_id,
    iqr.ingest_run_id,
    iqr.quality_score,
    iqr.blocked_downstream,
    date_trunc('day', iqr.created_at)              AS report_day
FROM ingest_quality_report iqr;

-- ---------------------------------------------------------------------------
-- v_analytics_domain_event
-- ---------------------------------------------------------------------------
-- One row per domain event.  learner_id is replaced by a SHA-256 hex digest so
-- analytics can track per-learner patterns without exposing the real identifier.
-- payload is excluded: it carries raw source values that may contain PII.

CREATE VIEW v_analytics_domain_event AS
SELECT
    del.id                                         AS event_id,
    del.tenant_id,
    encode(digest(del.learner_id::text, 'sha256'), 'hex')
                                                   AS learner_token,
    del.domain,
    del.event_type,
    date_trunc('day', del.occurred_at)             AS event_day
FROM domain_event_log del;

-- ---------------------------------------------------------------------------
-- Grant SELECT on the three views to analytics_ro
-- ---------------------------------------------------------------------------
-- No base-table grants. analytics_ro cannot read ingest_run, ingest_quality_report,
-- or domain_event_log directly — only through these views.

GRANT SELECT ON v_analytics_ingest_run     TO analytics_ro;
GRANT SELECT ON v_analytics_quality_report TO analytics_ro;
GRANT SELECT ON v_analytics_domain_event   TO analytics_ro;
