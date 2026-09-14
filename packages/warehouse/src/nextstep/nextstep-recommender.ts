// DW-08 Next-Step Recommender — Stage 09 step 7.
//
// Derives one concrete next action from a synthesised insight: what should
// happen, who owns it, and by when.
//
// dueDate and insightId are computed deterministically; owner is resolved
// from a scope×domain lookup table matching the prompt spec.  description
// and rationale come from the injected NextStepModelAdapter so the unit
// tier runs without a real model.
//
// Two outcomes via DW08Result:
//   ok          — nextStep with description, owner, dueDate, insightId, rationale
//   needs_input — no insight found for the requested insightId

import type { DW08Input } from '../agent-inputs.js';
import type {
  DataDomain,
  DW08Result,
  Insight,
  InsightScope,
  NextStep,
} from '../types.js';

// ---------------------------------------------------------------------------
// Store interface (injected; no direct DB import)
// ---------------------------------------------------------------------------

/**
 * Persistence boundary for DW-08.  The production adapter queries the
 * Brain (insight entries) through the tenant-scoped Prisma client.
 */
export interface InsightStore {
  loadInsight(tenantId: string, insightId: string): Promise<Insight | null>;
}

// ---------------------------------------------------------------------------
// Model adapter interface (injected; no direct gateway import)
// ---------------------------------------------------------------------------

/** Description and rationale produced by the model. */
export interface NextStepModelOutput {
  readonly description: string;
  readonly rationale: string;
}

/**
 * Model boundary for DW-08.  The production adapter calls the Model Gateway;
 * tests inject a stub that returns a fixed NextStepModelOutput.
 */
export interface NextStepModelAdapter {
  recommend(input: DW08Input, insight: Insight): Promise<NextStepModelOutput>;
}

// ---------------------------------------------------------------------------
// Deterministic helpers
// ---------------------------------------------------------------------------

/** Returns an ISO datetime exactly 7 calendar days after `isoDatetime`. */
function addSevenDays(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString();
}

/**
 * Resolves the responsible owner role from the scope × domain combination.
 * Rules are lifted verbatim from the DW-08 prompt spec.
 */
function resolveOwner(scope: InsightScope, domain: DataDomain): string {
  if (scope === 'LEARNER' && domain === 'ATTENDANCE') return 'class teacher';
  if (scope === 'CLASS' && domain === 'ASSESSMENT') return 'HOD';
  if (scope === 'GRADE' && domain === 'BEHAVIOUR') return 'deputy principal';
  if (scope === 'SCHOOL' && domain === 'WELLBEING') return 'school psychologist';
  return 'class teacher';
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Derives one next-step recommendation from a synthesised insight.
 *
 * @param input   DW08 agent input (insightId, scope, domain).
 * @param store   Injected insight store.
 * @param model   Injected model adapter (description + rationale).
 */
export async function recommendNextStep(
  input: DW08Input,
  store: InsightStore,
  model: NextStepModelAdapter,
): Promise<DW08Result> {
  const { tenantId, insightId, scope, domain } = input;

  const insight = await store.loadInsight(tenantId, insightId);

  if (!insight) {
    return {
      status: 'needs_input',
      detail: `No insight found for id ${insightId}.`,
    };
  }

  const modelOutput = await model.recommend(input, insight);
  const owner = resolveOwner(scope, domain);
  const dueDate = addSevenDays(insight.generatedAt);

  const nextStep: NextStep = {
    description: modelOutput.description,
    owner,
    dueDate,
    insightId,
    rationale: modelOutput.rationale,
  };

  return { status: 'ok', nextStep };
}
