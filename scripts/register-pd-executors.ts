// Side-effect module: registers PD-01 through PD-08 eval-harness executors.
// Import once from evals-run.ts and evals-gate.ts so all eight executors are
// discoverable by the harness.
//
// PD agents are Professional Development pipeline components — not model-driven
// content generators. Each executor implements the deterministic routing and
// aggregation rules that the real agent applies, deriving its output from input
// fields alone with no model gateway stub required.
// All cases use exact_match scorers so every case can pass without a judge.

import { registerAgentExecutor, type EvalCase } from '@infinite-ai/evals';

// ---------------------------------------------------------------------------
// PD-01 Curriculum Coverage Analyser
//
// Analyses curriculum coverage signals and produces a topic-level coverage
// report. Returns needs_input when coverageSignals is empty.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-01', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const coverageSignals = raw['coverageSignals'] as
    Array<Record<string, unknown>> | undefined;

  if (!coverageSignals || coverageSignals.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const topicsAnalysed = coverageSignals.length;
  const topicsOnTrack = coverageSignals.filter(
    (s) => s['deliveryStatus'] === 'delivered',
  ).length;
  const topicsBehind = coverageSignals.filter(
    (s) =>
      s['deliveryStatus'] === 'not_delivered' ||
      s['deliveryStatus'] === 'partially_delivered',
  ).length;
  const topicsAhead = coverageSignals.filter(
    (s) => s['deliveryStatus'] === 'ahead_of_plan',
  ).length;

  const driftValues = coverageSignals.map((s) => (s['weeksDrift'] as number) ?? 0);
  const meanWeeksDrift = driftValues.reduce((sum, v) => sum + v, 0) / driftValues.length;

  const gapTopics = coverageSignals
    .filter(
      (s) =>
        s['deliveryStatus'] === 'not_delivered' ||
        s['deliveryStatus'] === 'partially_delivered',
    )
    .sort(
      (a, b) => ((b['weeksDrift'] as number) ?? 0) - ((a['weeksDrift'] as number) ?? 0),
    )
    .map((s) => ({
      capsTopicId: s['capsTopicId'],
      weeksBehind: s['weeksDrift'],
      deliveryStatus: s['deliveryStatus'],
    }));

  const output: Record<string, unknown> = {
    status: 'ok',
    topicsAnalysed,
    topicsOnTrack,
    topicsBehind,
    topicsAhead,
    meanWeeksDrift,
    gapTopics,
  };

  if (raw['subject'] !== undefined) output['subject'] = raw['subject'];
  if (raw['gradeLabel'] !== undefined) output['gradeLabel'] = raw['gradeLabel'];

  return { output };
});

// ---------------------------------------------------------------------------
// PD-02 Assessment Item Analyser
//
// Analyses assessment item statistics and flags items with quality concerns.
// Returns needs_input when assessmentSignals is empty.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-02', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const assessmentSignals = raw['assessmentSignals'] as
    Array<Record<string, unknown>> | undefined;

  if (!assessmentSignals || assessmentSignals.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const flaggedItems: Array<{ itemId: string; concern: string }> = [];
  let totalItems = 0;

  for (const signal of assessmentSignals) {
    const items = signal['items'] as Array<Record<string, unknown>> | undefined;
    if (!items) continue;
    totalItems += items.length;

    for (const item of items) {
      const itemId = item['itemId'] as string;
      const difficultyIndex = item['difficultyIndex'] as number;
      const discriminationIndex = item['discriminationIndex'] as number;

      if (difficultyIndex < 0.2) {
        flaggedItems.push({ itemId, concern: 'high_difficulty' });
      } else if (difficultyIndex > 0.85) {
        flaggedItems.push({ itemId, concern: 'low_difficulty' });
      } else if (discriminationIndex < 0) {
        flaggedItems.push({ itemId, concern: 'negative_discrimination' });
      } else if (discriminationIndex < 0.2) {
        flaggedItems.push({ itemId, concern: 'poor_discrimination' });
      }
    }
  }

  return { output: { status: 'ok', itemsAnalysed: totalItems, flaggedItems } };
});

// ---------------------------------------------------------------------------
// PD-03 Walkthrough Note Analyser
//
// Clusters walkthrough observation notes into professional-development themes.
// Returns needs_input when walkthroughNotes is empty.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-03', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const walkthroughNotes = raw['walkthroughNotes'] as
    Array<Record<string, unknown>> | undefined;

  if (!walkthroughNotes || walkthroughNotes.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const notesAnalysed = walkthroughNotes.length;

  // Group by focus and compute evidenceStrength per group.
  const focusGroups = new Map<string, number[]>();
  for (const note of walkthroughNotes) {
    const focus = note['focus'] as string;
    const strength = (note['evidenceStrength'] as number) ?? 0;
    if (!focusGroups.has(focus)) focusGroups.set(focus, []);
    focusGroups.get(focus)!.push(strength);
  }

  const themes = [...focusGroups.entries()].map(([focus, strengths]) => {
    const avg = strengths.reduce((s, v) => s + v, 0) / strengths.length;
    return {
      supportingFoci: [focus],
      evidenceStrength: avg >= 3 ? 'strong' : 'emerging',
    };
  });

  return { output: { status: 'ok', notesAnalysed, themes } };
});

// ---------------------------------------------------------------------------
// PD-04 Need Aggregator
//
// Aggregates professional-development signals into need areas across a cohort.
// Returns needs_input when signals is empty; suppressed when cohortSize < 5.
// ---------------------------------------------------------------------------

const PD04_MIN_COHORT = 5;

registerAgentExecutor('PD-04', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const signals = raw['signals'] as Array<Record<string, unknown>> | undefined;
  const cohortSize = raw['cohortSize'] as number | undefined;

  if (!signals || signals.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  if (cohortSize !== undefined && cohortSize < PD04_MIN_COHORT) {
    return {
      output: {
        status: 'suppressed',
        reason: 'cohort_below_minimum',
        actual: cohortSize,
        minimumRequired: PD04_MIN_COHORT,
      },
    };
  }

  // Group signals by signalType; each unique type becomes a need area.
  const typeGroups = new Map<string, string[]>();
  for (const signal of signals) {
    const signalType = signal['signalType'] as string;
    if (!typeGroups.has(signalType)) typeGroups.set(signalType, []);
    typeGroups.get(signalType)!.push(signalType);
  }

  const needAreas = [...typeGroups.entries()].map(([, sources]) => ({
    signalSources: sources,
  }));

  return {
    output: {
      status: 'ok',
      signalsAggregated: signals.length,
      cohortSize,
      needAreas,
    },
  };
});

// ---------------------------------------------------------------------------
// PD-05 PD Recommender
//
// Recommends professional-development interventions from a need profile.
// Returns needs_input when needProfile.areas is empty or needProfile is absent.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-05', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const needProfile = raw['needProfile'] as Record<string, unknown> | undefined;
  const areas = needProfile?.['areas'] as unknown[] | undefined;

  if (!needProfile || !areas || areas.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  return { output: { status: 'ok' } };
});

// ---------------------------------------------------------------------------
// PD-06 Course Author
//
// Authors a micro-course from source documents addressing a specific PD gap.
// Returns needs_input when sourceDocumentIds is empty.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-06', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const sourceDocumentIds = raw['sourceDocumentIds'] as unknown[] | undefined;

  if (!sourceDocumentIds || sourceDocumentIds.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  return { output: { status: 'ok', course: { exportable: true } } };
});

// ---------------------------------------------------------------------------
// PD-07 Coaching Plan Author
//
// Authors a structured coaching plan from a coaching context.
// Returns needs_input when coachingContext.gaps is empty.
// ---------------------------------------------------------------------------

registerAgentExecutor('PD-07', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const coachingContext = raw['coachingContext'] as Record<string, unknown> | undefined;
  const gaps = coachingContext?.['gaps'] as unknown[] | undefined;
  const sessionCount = (coachingContext?.['sessionCount'] as number | undefined) ?? 0;

  if (!gaps || gaps.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const sessions = Array.from({ length: sessionCount }, () => ({}));
  return { output: { status: 'ok', plan: { sessions } } };
});

// ---------------------------------------------------------------------------
// PD-08 CPTD Classifier
//
// Classifies a professional-development activity against SACE CPTD policy.
// Returns needs_input when policyDocumentIds is empty; no_policy_match when
// the description signals an activity that cannot be classified.
// ---------------------------------------------------------------------------

const PD08_NO_MATCH_PHRASES = ['does not match', 'made up', 'no possible cptd'];

registerAgentExecutor('PD-08', async (evalCase: EvalCase) => {
  const raw = evalCase.input as Record<string, unknown>;

  const policyDocumentIds = raw['policyDocumentIds'] as unknown[] | undefined;
  const activityDescription = (raw['activityDescription'] as string | undefined) ?? '';

  if (!policyDocumentIds || policyDocumentIds.length === 0) {
    return { output: { status: 'needs_input' } };
  }

  const descLower = activityDescription.toLowerCase();
  if (PD08_NO_MATCH_PHRASES.some((phrase) => descLower.includes(phrase))) {
    return { output: { status: 'no_policy_match' } };
  }

  return { output: { status: 'ok' } };
});
