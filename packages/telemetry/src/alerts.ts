// Alert catalog — Stage 15 step 5.
//
// Every alert must name an owner and a first action. Alerting on burn rate rather than
// individual failures prevents alert fatigue while catching sustained degradation before
// the error budget is exhausted. Each rule maps directly to an SLO in slos.ts.

export type AlertSeverity = 'page' | 'ticket' | 'watch';

export interface AlertRule {
  readonly name: string;
  readonly severity: AlertSeverity;
  /** Role, not individual — on-call rotation maps role to person. */
  readonly owner: string;
  /** Runbook filename under docs/RUNBOOKS/. */
  readonly runbook: string;
  /** What to do first — a single concrete action, not a procedure. */
  readonly firstAction: string;
  /** The SLO name this alert protects. */
  readonly slo: string;
}

export const ALERT_CATALOG: readonly AlertRule[] = [
  {
    name: 'web_availability_burn_rate',
    severity: 'page',
    owner: 'platform-engineer-on-call',
    runbook: 'region-loss.md',
    firstAction:
      'Check the load balancer health dashboard and the last deploy; roll back the deploy if it coincides with the burn start.',
    slo: 'web_availability',
  },
  {
    name: 'agent_run_failure_burst',
    severity: 'page',
    owner: 'platform-engineer-on-call',
    runbook: 'queue-backlog.md',
    firstAction:
      'Check the worker error logs for the top failure reason; if it is a provider error, confirm gateway fallback is operating.',
    slo: 'agent_run_success_rate',
  },
  {
    name: 'time_to_artefact_p95_exceeded',
    severity: 'ticket',
    owner: 'platform-engineer-on-call',
    runbook: 'queue-backlog.md',
    firstAction:
      'Check the orchestrator queue depth and worker throughput; scale workers if queue is growing.',
    slo: 'time_to_artefact_p95',
  },
  {
    name: 'approval_queue_age_exceeded',
    severity: 'ticket',
    owner: 'product-support',
    runbook: 'queue-backlog.md',
    firstAction:
      'Identify the tenant and artefact; notify the HoD that an approval has been waiting beyond the SLA.',
    slo: 'approval_queue_age',
  },
  {
    name: 'ingest_freshness_stale',
    severity: 'ticket',
    owner: 'platform-engineer-on-call',
    runbook: 'queue-backlog.md',
    firstAction:
      'Check the ingest connector status and the last successful run timestamp; restart the connector if it is stuck.',
    slo: 'ingest_freshness',
  },
  {
    name: 'guardrail_refusal_rate_spike',
    severity: 'ticket',
    owner: 'ml-safety-lead',
    runbook: 'bad-prompt-promotion-rollback.md',
    firstAction:
      'Check which agent and module is producing the spike; if it correlates with a recent prompt promotion, initiate rollback.',
    slo: 'agent_run_success_rate',
  },
  {
    name: 'token_cost_anomaly',
    severity: 'ticket',
    owner: 'platform-engineer-on-call',
    runbook: 'queue-backlog.md',
    firstAction:
      'Identify the tenant and module driving the cost spike; check for runaway retry loops in the gateway logs.',
    slo: 'agent_run_success_rate',
  },
  {
    name: 'brain_retrieval_latency_p99',
    severity: 'watch',
    owner: 'platform-engineer-on-call',
    runbook: 'brain-restore.md',
    firstAction:
      'Check pgvector index health and query plans; VACUUM ANALYZE if index bloat is suspected.',
    slo: 'time_to_artefact_p95',
  },
] as const;

/** All alert names that resolve to a specific runbook file. */
export type AlertName = (typeof ALERT_CATALOG)[number]['name'];
