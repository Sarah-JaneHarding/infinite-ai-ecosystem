// Metric name registry — Stage 15 step 3.
//
// Every metric emitted by any package goes through this registry as a typed constant.
// Stringly-typed metric names are a common source of silent mismatch between the code
// that emits a metric and the dashboard that queries it — a name change in one place
// silently breaks the other. Named constants make that a compile-time error instead.

export const METRICS = {
  // Request / job latency
  HTTP_REQUEST_DURATION_MS: 'http.request.duration_ms',
  AGENT_RUN_DURATION_MS: 'agent.run.duration_ms',
  GATEWAY_CALL_DURATION_MS: 'gateway.call.duration_ms',
  BRAIN_RETRIEVAL_DURATION_MS: 'brain.retrieval.duration_ms',
  DB_QUERY_DURATION_MS: 'db.query.duration_ms',

  // Queue
  ORCHESTRATOR_QUEUE_DEPTH: 'orchestrator.queue.depth',
  ORCHESTRATOR_QUEUE_AGE_MS: 'orchestrator.queue.age_ms',
  APPROVAL_QUEUE_DEPTH: 'approval.queue.depth',
  APPROVAL_QUEUE_AGE_MS: 'approval.queue.age_ms',

  // Agent outcomes
  AGENT_RUN_SUCCESS_TOTAL: 'agent.run.success.total',
  AGENT_RUN_FAILURE_TOTAL: 'agent.run.failure.total',
  AGENT_REFUSAL_TOTAL: 'agent.refusal.total',

  // Guardrails
  GUARDRAIL_PII_BLOCK_TOTAL: 'guardrail.pii_block.total',
  GUARDRAIL_INJECTION_BLOCK_TOTAL: 'guardrail.injection_block.total',
  GUARDRAIL_BUDGET_BLOCK_TOTAL: 'guardrail.budget_block.total',
  GUARDRAIL_SAFEGUARD_ESCALATION_TOTAL: 'guardrail.safeguard_escalation.total',

  // Eval scores
  EVAL_SCORE: 'eval.score',
  EVAL_PASS_TOTAL: 'eval.pass.total',
  EVAL_FAIL_TOTAL: 'eval.fail.total',

  // Token cost
  TOKEN_COST_ZAR: 'token.cost_zar',
  TOKEN_PROMPT_TOTAL: 'token.prompt.total',
  TOKEN_COMPLETION_TOTAL: 'token.completion.total',

  // Gateway
  GATEWAY_CACHE_HIT_TOTAL: 'gateway.cache_hit.total',
  GATEWAY_CACHE_MISS_TOTAL: 'gateway.cache_miss.total',
  GATEWAY_PROVIDER_FALLBACK_TOTAL: 'gateway.provider_fallback.total',

  // Data quality
  DATA_QUALITY_SCORE: 'data.quality.score',
  INGEST_FRESHNESS_MS: 'ingest.freshness_ms',
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

/** Standard dimensions (OTel attribute keys) attached to every metric. */
export const METRIC_DIMS = {
  TENANT_ID: 'tenant.id',
  MODULE: 'module',
  AGENT: 'agent',
  PROVIDER: 'provider',
  STATUS: 'status',
} as const;
