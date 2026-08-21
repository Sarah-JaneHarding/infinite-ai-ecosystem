// Side-effect module: registers LE-01 through LE-09 eval-harness executors.
// Import once from evals-run.ts and evals-gate.ts so all nine executors are
// discoverable by the harness.
//
// LE agents are Learning Engine pipeline components — not content generators.
// Each executor implements the deterministic decision rules that the agent
// encapsulates, deriving its output from input fields alone with no model
// gateway stub required.
//
// LE-07 is the exception that tests explicit numeric thresholds: the executor
// implements promote/reject logic that the real agent applies via LLM reasoning.
// All cases use exact_match scorers so every case can pass without a judge.

import { registerAgentExecutor, type EvalCase } from '@infinite-ai/evals';

// ---------------------------------------------------------------------------
// LE-01 Gate Event Recorder
//
// Records artefact gate decisions (approved / edited / rejected) emitted by
// human reviewers. Returns needs_input when a rejection carries no reasonCode —
// the ledger cannot record an unqualified rejection.
// ---------------------------------------------------------------------------

registerAgentExecutor('LE-01', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const eventType = raw['eventType'] as string | undefined;
  const reasonCode = raw['reasonCode'] as string | undefined;

  if (eventType === 'rejected' && !reasonCode) {
    return { output: { status: 'needs_input' } };
  }

  const event: Record<string, unknown> = { label: eventType };
  if (reasonCode) event['reasonCode'] = reasonCode;
  if (raw['artefactType']) event['artefactType'] = raw['artefactType'];
  if (raw['capsTopicId']) event['capsTopicId'] = raw['capsTopicId'];
  if (raw['agentId']) event['agentId'] = raw['agentId'];
  if (raw['tenantId']) event['tenantId'] = raw['tenantId'];
  if (raw['artefactId']) event['artefactId'] = raw['artefactId'];

  return { output: { status: 'ok', event } };
});

// ---------------------------------------------------------------------------
// LE-02 Edit Classifier
//
// Classifies the dominant correction type from an artefact edit diff.
// Returns needs_input when the diff contains no field edits (a no-op edit).
// ---------------------------------------------------------------------------

registerAgentExecutor('LE-02', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const editDiff = raw['editDiff'] as Record<string, unknown> | undefined;
  const fieldEdits = editDiff?.['fieldEdits'] as unknown[] | undefined;
  const totalChanged = editDiff?.['totalCharactersChanged'] as number | undefined;

  if (!fieldEdits || fieldEdits.length === 0 || totalChanged === 0) {
    return { output: { status: 'needs_input' } };
  }

  const reasonCode = raw['reasonCode'] as string;
  return { output: { status: 'ok', primaryCorrectionType: reasonCode } };
});

// ---------------------------------------------------------------------------
// LE-03 Outcome Attributor
//
// Attributes learning outcome signals to the artefact that delivered them.
// Returns needs_input when no signals were supplied, insufficient_data when
// the cohort is too small to attribute with confidence (< 3 signals).
// ---------------------------------------------------------------------------

const LE03_MIN_COHORT = 3;

registerAgentExecutor('LE-03', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const signals = raw['outcomeSignals'] as unknown[] | undefined;

  if (!signals || signals.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  if (signals.length < LE03_MIN_COHORT) {
    return { output: { status: 'insufficient_data' } };
  }

  return { output: { status: 'ok', cohortSize: signals.length } };
});

// ---------------------------------------------------------------------------
// LE-04 Pattern Aggregator
//
// Aggregates outcome attributions into reusable artefact patterns. Returns
// needs_input when there are no attributions and no stratification fields;
// below_threshold when attributions exist but are too few to form a pattern.
// ---------------------------------------------------------------------------

const LE04_MIN_ATTRIBUTIONS = 10;

registerAgentExecutor('LE-04', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const attributions = raw['attributions'] as unknown[] | undefined;
  const stratFields = raw['stratificationFields'] as unknown[] | undefined;

  if (
    (!attributions || attributions.length === 0) &&
    (!stratFields || stratFields.length === 0)
  ) {
    return { output: { status: 'needs_input' } };
  }

  if (!attributions || attributions.length < LE04_MIN_ATTRIBUTIONS) {
    return { output: { status: 'below_threshold' } };
  }

  return { output: { status: 'ok' } };
});

// ---------------------------------------------------------------------------
// LE-05 Candidate Ranker
//
// Ranks artefact candidates for potential promotion to the pattern library.
// Returns needs_input when the candidates list is empty; no_candidates when
// all candidates score below the promotion threshold.
// ---------------------------------------------------------------------------

const LE05_PROMOTION_THRESHOLD = 0.5;

registerAgentExecutor('LE-05', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const candidates = raw['candidates'] as Array<Record<string, unknown>> | undefined;

  if (!candidates || candidates.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const eligible = candidates.filter(
    (c) =>
      typeof c['evalScore'] === 'number' &&
      (c['evalScore'] as number) >= LE05_PROMOTION_THRESHOLD,
  );

  if (eligible.length === 0) {
    return { output: { status: 'no_candidates' } };
  }

  const ranked = eligible.map((c) => ({ ...c, promoted: false }));
  return { output: { status: 'ok', candidates: ranked } };
});

// ---------------------------------------------------------------------------
// LE-06 Prompt Challenger
//
// Generates a challenger prompt variant from observed correction patterns.
// Returns needs_input when no patterns were supplied; no_improvement_found
// when the pattern frequency is too low to justify a challenger.
// ---------------------------------------------------------------------------

const LE06_MIN_FREQUENCY = 5;

registerAgentExecutor('LE-06', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const patterns = raw['correctionPatterns'] as
    Array<Record<string, unknown>> | undefined;

  if (!patterns || patterns.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const maxFrequency = Math.max(...patterns.map((p) => (p['frequency'] as number) ?? 0));

  if (maxFrequency < LE06_MIN_FREQUENCY) {
    return { output: { status: 'no_improvement_found' } };
  }

  return {
    output: {
      status: 'ok',
      challenger: {
        isLive: false,
        version: '1.0.0',
        content: `Revised prompt addressing: ${patterns.map((p) => p['correctionType']).join(', ')}.`,
      },
    },
  };
});

// ---------------------------------------------------------------------------
// LE-07 Challenger Verdict
//
// Decides whether a challenger prompt beats the current champion. Applies
// strict gates in order: bias check → regression check → improvement check.
// ---------------------------------------------------------------------------

registerAgentExecutor('LE-07', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const champ = raw['championEvalResult'] as Record<string, number> | undefined;
  const chall = raw['challengerEvalResult'] as Record<string, number> | undefined;
  const biasCheckPassed = raw['biasCheckPassed'];

  if (biasCheckPassed === false) {
    return { output: { status: 'ok', verdict: 'reject_bias_divergence' } };
  }

  const challRegress = chall?.['mustNotRegressPassRate'] ?? 1;
  if (challRegress < 1) {
    return { output: { status: 'ok', verdict: 'reject_regression' } };
  }

  const champPass = champ?.['overallPassRate'] ?? 0;
  const challPass = chall?.['overallPassRate'] ?? 0;

  if (challPass > champPass) {
    return { output: { status: 'ok', verdict: 'promote' } };
  }

  return { output: { status: 'ok', verdict: 'reject_no_improvement' } };
});

// ---------------------------------------------------------------------------
// LE-08 Pattern Publisher
//
// Publishes a de-identified artefact pattern to the ecosystem for cross-tenant
// learning. Requires the publishing tenant to have opted in and a minimum of
// five contributing tenants to satisfy anonymisation requirements.
// ---------------------------------------------------------------------------

const LE08_MIN_CONTRIBUTING_TENANTS = 5;

registerAgentExecutor('LE-08', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const tenantOptIn = raw['tenantOptIn'] as boolean | undefined;
  const refs = raw['contributingTenantRefs'] as unknown[] | undefined;
  const refCount = refs?.length ?? 0;

  if (refCount < LE08_MIN_CONTRIBUTING_TENANTS) {
    return {
      output: {
        status: 'suppressed_below_threshold',
        required: LE08_MIN_CONTRIBUTING_TENANTS,
        contributingTenantCount: refCount,
      },
    };
  }

  if (!tenantOptIn) {
    return { output: { status: 'suppressed_no_opt_in' } };
  }

  return { output: { status: 'published' } };
});

// ---------------------------------------------------------------------------
// LE-09 Pattern Validator
//
// Validates that a published artefact pattern is still current. Invalidates
// when the CAPS curriculum version has changed or revalidation failed.
// Requires revalidation when the TTL has elapsed.
// ---------------------------------------------------------------------------

registerAgentExecutor('LE-09', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const currentCapsVersion = raw['currentCapsVersion'] as string | null | undefined;
  const patternCapsVersion = raw['patternCapsVersion'] as string | null | undefined;
  const revalResult = raw['revalidationResult'] as
    { passRate: number; requiredPassRate: number } | undefined;
  const lastValidatedAt = raw['lastValidatedAt'] as string | undefined;
  const ttlDays = raw['ttlDays'] as number | undefined;
  const today = raw['today'] as string | undefined;

  if (
    currentCapsVersion != null &&
    patternCapsVersion != null &&
    currentCapsVersion !== patternCapsVersion
  ) {
    return { output: { status: 'invalidated' } };
  }

  if (revalResult != null && revalResult.passRate < revalResult.requiredPassRate) {
    return { output: { status: 'invalidated' } };
  }

  if (lastValidatedAt != null && ttlDays != null && today != null) {
    const validatedMs = new Date(lastValidatedAt).getTime();
    const todayMs = new Date(today).getTime();
    const elapsedDays = (todayMs - validatedMs) / (1000 * 60 * 60 * 24);
    if (elapsedDays > ttlDays) {
      return { output: { status: 'revalidation_required' } };
    }
  }

  return { output: { status: 'valid' } };
});
