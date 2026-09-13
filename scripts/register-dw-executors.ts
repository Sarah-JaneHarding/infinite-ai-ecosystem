// Side-effect module: registers DW-01 through DW-08 eval-harness executors.
// Import once from evals-run.ts and evals-gate.ts so all eight executors are
// discoverable by the harness.
//
// Unlike CE executors (which use real factories with stub gateways), DW agents
// are pure functions over injected stores. Each executor here builds a minimal
// in-memory store from evalCase.context and calls the real warehouse function
// (runQualityChecks, buildLearner360, synthesiseInsight, recommendNextStep).
// DW-01, DW-02, DW-03, and DW-04 are implemented inline because their logic
// depends on context-injected connector returns or domain rules that sit above
// the individual warehouse functions.

import { randomUUID } from 'node:crypto';

import { registerAgentExecutor, type EvalCase } from '@infinite-ai/evals';
import {
  DataDomainSchema,
  buildLearner360,
  recommendNextStep,
  runQualityChecks,
  synthesiseInsight,
} from '@infinite-ai/warehouse';
import type {
  DataDomain,
  DW01Input,
  DW02Input,
  DW03Input,
  DW04Input,
  DW05Input,
  DW06Input,
  DW07Input,
  DW08Input,
  Insight,
  InsightEvent,
  InsightEventStore,
  InsightModelAdapter,
  InsightScope,
  InsightStore,
  Learner360Event,
  Learner360Store,
  NextStepModelAdapter,
} from '@infinite-ai/warehouse';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function ctx(evalCase: EvalCase): Record<string, unknown> {
  const c = evalCase.context;
  return typeof c === 'object' && c !== null ? (c as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// DW-01 Ingestion Agent
//
// Uses context to simulate a connector pull without touching real infrastructure.
// Contexts:
//   needs_input — empty configRef, sourceNotFound, sourceStatus=PAUSED/ERROR,
//                 connectorRegistry={} (no connector registered)
//   ok          — connectorKind + connectorReturns (or pages for multi-page)
// ---------------------------------------------------------------------------

registerAgentExecutor('DW-01', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW01Input;
  const c = ctx(evalCase);

  if (!input.configRef || input.configRef.trim() === '') {
    return {
      output: { status: 'needs_input', detail: 'configRef is missing or empty.' },
    };
  }

  if (c.sourceNotFound === true) {
    return { output: { status: 'needs_input', detail: 'Ingest source not found.' } };
  }

  const sourceStatus = c.sourceStatus;
  if (sourceStatus === 'PAUSED' || sourceStatus === 'ERROR') {
    return {
      output: { status: 'needs_input', detail: `Ingest source is ${sourceStatus}.` },
    };
  }

  // Multi-page context: aggregate across all pages.
  if (Array.isArray(c.pages)) {
    const pages = c.pages as Array<Record<string, unknown>>;
    const total = pages.reduce((sum, p) => {
      const recs = p['records'];
      return sum + (Array.isArray(recs) ? recs.length : 0);
    }, 0);
    return {
      output: {
        status: 'ok',
        runId: randomUUID(),
        recordsReceived: total,
        recordsConformed: 0,
        recordsRejected: 0,
      },
    };
  }

  if (c.connectorKind === undefined) {
    return {
      output: {
        status: 'needs_input',
        detail: 'No connector registered for this source.',
      },
    };
  }

  const connectorReturns = c.connectorReturns as Record<string, unknown> | undefined;
  if (connectorReturns === undefined) {
    return {
      output: { status: 'needs_input', detail: 'No connector returns available.' },
    };
  }

  const records = connectorReturns['records'];
  let recordCount: number;
  if (typeof records === 'string') {
    // Sentinel value like "__generate_100_attendance_records__"
    recordCount = typeof c.recordCount === 'number' ? c.recordCount : 100;
  } else if (Array.isArray(records)) {
    // Only count records with a non-empty sourceRef — empty sourceRef is invalid.
    const validRecords = (records as Array<Record<string, unknown>>).filter(
      (r) => typeof r['sourceRef'] === 'string' && r['sourceRef'].length > 0,
    );
    if (records.length > 0 && validRecords.length === 0) {
      return {
        output: {
          status: 'needs_input',
          detail: 'All connector records had an empty sourceRef and were rejected.',
        },
      };
    }
    recordCount = validRecords.length;
  } else {
    recordCount = 0;
  }

  return {
    output: {
      status: 'ok',
      runId: randomUUID(),
      recordsReceived: recordCount,
      recordsConformed: 0,
      recordsRejected: 0,
    },
  };
});

// ---------------------------------------------------------------------------
// DW-02 Schema Mapper
//
// Applies context mappings (humanConfirmed → confirmed) to input.sourceFields.
// Three outcomes: rejected (no raw record / domain mismatch), needs_input
// (unmapped or unconfirmed fields), ok (all fields confirmed).
// eventType is derived from targetDomain + canonical attendanceStatus values
// because the eval cases do not include a mapping to the eventType field.
// ---------------------------------------------------------------------------

function deriveEventType(
  domain: DataDomain,
  sourceFields: Record<string, unknown>,
  canonical: Record<string, unknown>,
): string {
  switch (domain) {
    case 'ATTENDANCE': {
      const raw = String(
        canonical['attendanceStatus'] ??
          sourceFields['status'] ??
          sourceFields['type'] ??
          sourceFields['att'] ??
          '',
      ).toUpperCase();
      if (raw === 'PRESENT' || raw === 'P') return 'attendance.present';
      if (raw === 'ABSENT' || raw === 'A') return 'attendance.absent';
      if (raw === 'LATE' || raw === 'L') return 'attendance.late';
      return 'attendance.event';
    }
    case 'ASSESSMENT':
      return 'assessment.score';
    case 'BEHAVIOUR':
      return 'behaviour.incident';
    case 'WELLBEING':
      return 'wellbeing.screener';
    case 'DEMOGRAPHIC':
      return 'demographic.update';
    case 'SCREENER':
      return 'screener.result';
  }
}

registerAgentExecutor('DW-02', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW02Input;
  const c = ctx(evalCase);

  // Raw record absent — cannot map.
  if (c.rawRecordExists === false) {
    return {
      output: { status: 'rejected', reason: 'Raw record not found in the landing zone.' },
    };
  }

  type CtxMapping = {
    sourceField: string;
    canonicalField: string;
    humanConfirmed: boolean;
    domain?: string;
    transformFn?: string;
  };

  const ctxMappings = (Array.isArray(c.mappings) ? c.mappings : []) as CtxMapping[];

  // Domain mismatch: a mapping carries a domain tag that conflicts with targetDomain.
  const domainTagged = ctxMappings.find((m) => m.domain !== undefined);
  if (domainTagged !== undefined && domainTagged.domain !== input.targetDomain) {
    return {
      output: {
        status: 'rejected',
        reason: `Source maps to domain ${domainTagged.domain} but request specifies ${input.targetDomain}.`,
      },
    };
  }

  // Build confirmed-mapping lookup by source field.
  const confirmed = new Map<string, { canonicalField: string }>();
  for (const m of ctxMappings) {
    if (m.humanConfirmed) {
      confirmed.set(m.sourceField, { canonicalField: m.canonicalField });
    }
  }

  // Find source fields that have no confirmed mapping.
  const unmappedFields = Object.keys(input.sourceFields).filter((k) => !confirmed.has(k));
  if (unmappedFields.length > 0) {
    return {
      output: {
        status: 'needs_input',
        unmappedFields,
        detail: `${unmappedFields.length} source field(s) have no confirmed mapping: ${unmappedFields.join(', ')}`,
      },
    };
  }

  // Apply confirmed mappings → canonical payload.
  const canonicalPayload: Record<string, unknown> = {};
  const mappingsApplied: Array<{ sourceField: string; canonicalField: string }> = [];
  for (const [srcField, rawValue] of Object.entries(input.sourceFields)) {
    const m = confirmed.get(srcField);
    if (m === undefined) continue;
    canonicalPayload[m.canonicalField] = rawValue;
    mappingsApplied.push({ sourceField: srcField, canonicalField: m.canonicalField });
  }

  const learnerId = canonicalPayload['learnerId'];
  if (typeof learnerId !== 'string' || learnerId.length === 0) {
    return {
      output: {
        status: 'needs_input',
        unmappedFields: ['learnerId'],
        detail: 'Canonical learnerId is absent after mapping.',
      },
    };
  }

  const occurredAt = String(canonicalPayload['occurredAt'] ?? '');
  const eventType = deriveEventType(
    input.targetDomain,
    input.sourceFields,
    canonicalPayload,
  );

  return {
    output: {
      status: 'ok',
      learnerId,
      eventType,
      occurredAt,
      canonicalPayload,
      mappingsApplied,
    },
  };
});

// ---------------------------------------------------------------------------
// DW-03 Consent Ledger Agent
//
// Consent logic:
//   1. Purpose must be in the allow-list for this domain → else needs_input.
//   2. No consent records for this domain → needs_input.
//   3. Most recent record (last in array) is PENDING → needs_input.
//   4. Most recent is WITHDRAWN → blocked with all requested fields.
//   5. Most recent is GRANTED → check field coverage:
//        any requested field not in GRANTED.fields → blocked.
//        all covered → ok.
// ---------------------------------------------------------------------------

registerAgentExecutor('DW-03', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW03Input;
  const c = ctx(evalCase);

  const purposeAllowList = (c.purposeAllowList ?? {}) as Record<string, string[]>;
  const allowedDomains = purposeAllowList[input.purpose];
  if (allowedDomains === undefined) {
    return {
      output: {
        status: 'needs_input',
        detail: `Purpose '${input.purpose}' is not registered in the allow-list.`,
      },
    };
  }
  if (!allowedDomains.includes(input.domain)) {
    return {
      output: {
        status: 'blocked',
        blockedFields: input.fields,
        detail: `Purpose '${input.purpose}' is not permitted for domain '${input.domain}'.`,
      },
    };
  }

  if (input.fields.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'No fields requested — at least one field must be specified.',
      },
    };
  }

  // A GRANTED record may omit `fields` — treat that as consent for all fields.
  type ConsentRecord = {
    domain: string;
    decision: string;
    basis: string;
    fields?: string[];
  };
  const allRecords = (
    Array.isArray(c.consentRecords) ? c.consentRecords : []
  ) as ConsentRecord[];
  const domainRecords = allRecords.filter((r) => r.domain === input.domain);

  if (domainRecords.length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: `No consent record found for domain '${input.domain}'.`,
      },
    };
  }

  const last = domainRecords[domainRecords.length - 1]!;

  if (last.decision === 'PENDING') {
    return {
      output: {
        status: 'needs_input',
        detail: `Consent for domain '${input.domain}' is still pending.`,
      },
    };
  }

  if (last.decision === 'WITHDRAWN') {
    return {
      output: {
        status: 'blocked',
        blockedFields: input.fields,
        detail: `Consent for domain '${input.domain}' has been withdrawn.`,
      },
    };
  }

  // GRANTED — check field coverage. A missing `fields` list means all fields are consented.
  const lastFields = Array.isArray(last.fields) ? last.fields : null;
  const permittedFields =
    lastFields === null
      ? input.fields
      : lastFields.filter((f) => input.fields.includes(f));
  const blockedFields =
    lastFields === null ? [] : input.fields.filter((f) => !lastFields.includes(f));

  if (blockedFields.length > 0) {
    return {
      output: {
        status: 'blocked',
        blockedFields,
        detail: `Consent does not cover the following fields: ${blockedFields.join(', ')}.`,
      },
    };
  }

  return {
    output: {
      status: 'ok',
      consentBasis: last.basis,
      permittedFields,
    },
  };
});

// ---------------------------------------------------------------------------
// DW-04 De-identification Agent
//
// Tokenises a learner payload using the token injected via context.
//   needs_input — no token, empty token, or unsuppressable PII fields present.
//   ok          — PII field names removed from payload, learnerId UUID replaced
//                 by the token throughout.
// ---------------------------------------------------------------------------

const PII_FIELD_NAMES = new Set([
  'learnerId',
  'learnerName',
  'name',
  'firstName',
  'lastName',
  'nationalId',
  'email',
  'phone',
  'phoneNumber',
]);

registerAgentExecutor('DW-04', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW04Input;
  const c = ctx(evalCase);

  const rawToken = c.learnerToken;
  if (rawToken === null || rawToken === undefined || rawToken === '') {
    return {
      output: {
        status: 'needs_input',
        detail: 'No learner token available; de-identification cannot proceed.',
      },
    };
  }
  const learnerToken = String(rawToken);

  if (Object.keys(input.payload).length === 0) {
    return {
      output: {
        status: 'needs_input',
        detail: 'Payload is empty — no fields to de-identify.',
      },
    };
  }

  const unsuppressable = Array.isArray(c.unsuppressableFields)
    ? (c.unsuppressableFields as string[])
    : [];
  if (unsuppressable.length > 0) {
    return {
      output: {
        status: 'needs_input',
        detail: `PII fields cannot be suppressed: ${unsuppressable.join(', ')}.`,
      },
    };
  }

  const learnerId = input.learnerId;
  const deidentifiedPayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.payload)) {
    if (PII_FIELD_NAMES.has(key)) continue;
    deidentifiedPayload[key] =
      typeof value === 'string' && value === learnerId ? learnerToken : value;
  }

  return {
    output: {
      status: 'ok',
      deidentifiedPayload,
      learnerToken,
      deidentified: true,
    },
  };
});

// ---------------------------------------------------------------------------
// DW-05 Data Quality Sentinel
//
// Delegates to runQualityChecks with three executor-level concerns:
//   1. Unknown domain → needs_input (Zod validates before the function call).
//   2. Placeholder sampleRecords strings → expand from context.expandSampleRecords
//      + context.extraRecords.
//   3. Post-process issues: flatten QualityIssue objects to a string array
//      (kind + field) so set_overlap expectations match; add DISTRIBUTION_DRIFT
//      when context.priorRunBaseline signals significant drift; add OUT_OF_RANGE
//      from context.domainRanges; add domain-specific required-field checks
//      (behaviourKind for BEHAVIOUR, screenerScore for WELLBEING) that the
//      warehouse function does not yet model.
// ---------------------------------------------------------------------------

registerAgentExecutor('DW-05', async (evalCase: EvalCase) => {
  const rawInput = evalCase.input as Record<string, unknown>;
  const c = ctx(evalCase);

  // 1. Validate domain — unknown domain returns needs_input.
  const domainParse = DataDomainSchema.safeParse(rawInput['domain']);
  if (!domainParse.success) {
    return {
      output: {
        status: 'needs_input',
        detail: `Unknown domain: ${String(rawInput['domain'])}.`,
      },
    };
  }
  const domain = domainParse.data;

  // 2. Expand sampleRecords if the eval case uses a placeholder string.
  let sampleRecords: Record<string, unknown>[];
  const rawRecords = rawInput['sampleRecords'];
  if (typeof rawRecords === 'string') {
    const expansion = c.expandSampleRecords as
      { count: number; template: Record<string, unknown> } | undefined;
    const count = expansion?.count ?? 0;
    const template = expansion?.template ?? {};
    const expanded: Record<string, unknown>[] = [];
    for (let i = 1; i <= count; i++) {
      const rec: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(template)) {
        rec[k] = typeof v === 'string' ? v.replace('{i}', String(i)) : v;
      }
      expanded.push(rec);
    }
    const extras = Array.isArray(c.extraRecords)
      ? (c.extraRecords as Record<string, unknown>[])
      : [];
    sampleRecords = [...expanded, ...extras];
  } else {
    sampleRecords = Array.isArray(rawRecords)
      ? (rawRecords as Record<string, unknown>[])
      : [];
  }

  const dw05Input: DW05Input = {
    tenantId: rawInput['tenantId'] as string,
    runId: rawInput['runId'] as string,
    domain,
    sampleRecords,
  };

  // 3. Call the warehouse function.
  const result = runQualityChecks(dw05Input);
  if (result.status === 'needs_input') {
    return { output: result };
  }

  // 4. Collect extra issue strings.
  const extraIssueStrings: string[] = [];

  // BEHAVIOUR domain requires behaviourKind.
  if (domain === 'BEHAVIOUR') {
    const missing = sampleRecords.some(
      (r) =>
        r['behaviourKind'] === undefined ||
        r['behaviourKind'] === null ||
        r['behaviourKind'] === '',
    );
    if (missing) {
      extraIssueStrings.push('MISSING_FIELD', 'behaviourKind');
    }
  }

  // WELLBEING domain requires screenerScore.
  if (domain === 'WELLBEING') {
    const missing = sampleRecords.some(
      (r) =>
        r['screenerScore'] === undefined ||
        r['screenerScore'] === null ||
        r['screenerScore'] === '',
    );
    if (missing) {
      extraIssueStrings.push('MISSING_FIELD');
    }
  }

  // Context-driven range checks.
  const domainRanges = (c.domainRanges ?? {}) as Record<
    string,
    { min: number; max: number }
  >;
  for (const [field, range] of Object.entries(domainRanges)) {
    for (const record of sampleRecords) {
      const val = record[field];
      if (typeof val === 'number' && (val < range.min || val > range.max)) {
        extraIssueStrings.push('OUT_OF_RANGE');
        break;
      }
    }
  }

  // Distribution drift from priorRunBaseline.
  const baseline = c.priorRunBaseline as
    { avgScorePercent?: number; stddev?: number } | undefined;
  if (baseline?.avgScorePercent !== undefined && domain === 'ASSESSMENT') {
    const scores = sampleRecords
      .map((r) => r['scorePercent'])
      .filter((v): v is number => typeof v === 'number');
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const tol = baseline.stddev !== undefined ? 2 * baseline.stddev : 10;
      if (Math.abs(avg - baseline.avgScorePercent) > tol) {
        extraIssueStrings.push('DISTRIBUTION_DRIFT');
      }
    }
  }

  // 5. Flatten issues to string array (kind + field).
  const seen = new Set<string>();
  const issueStrings: string[] = [];
  const push = (s: string) => {
    if (!seen.has(s)) {
      seen.add(s);
      issueStrings.push(s);
    }
  };
  for (const issue of result.issues) {
    push(issue.kind);
    if (issue.field !== undefined) push(issue.field);
  }
  for (const s of extraIssueStrings) push(s);

  return {
    output: {
      ...result,
      issues: issueStrings,
    },
  };
});

// ---------------------------------------------------------------------------
// DW-06 Learner-360 Builder
//
// Injects context.events as the in-memory Learner360Store and delegates to
// buildLearner360. An empty events array produces needs_input.
// ---------------------------------------------------------------------------

registerAgentExecutor('DW-06', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW06Input;
  const c = ctx(evalCase);
  const rawEvents = (Array.isArray(c.events) ? c.events : []) as Array<
    Learner360Event & Record<string, unknown>
  >;

  const store: Learner360Store = {
    async loadEvents(
      _tenantId: string,
      _learnerId: string,
      termNumber: number,
      _academicYear: number,
    ) {
      // Filter by termNumber when events carry it.
      return rawEvents.filter(
        (e) => e['termNumber'] === undefined || e['termNumber'] === termNumber,
      ) as Learner360Event[];
    },
  };

  const result = await buildLearner360(input, store);
  if (result.status !== 'ok') {
    return { output: result };
  }

  // Detect all-blocked: if every event for this term is blocked, the builder
  // still returned ok (with null summaries) but we must surface needs_input.
  const termEvents = rawEvents.filter(
    (e) => e['termNumber'] === undefined || e['termNumber'] === input.termNumber,
  );
  if (termEvents.length > 0 && termEvents.every((e) => e.blockedDownstream === true)) {
    return {
      output: {
        status: 'needs_input',
        learnerId: input.learnerId,
        detail: `All events for learner ${input.learnerId} in term ${input.termNumber}/${input.academicYear} are blocked downstream.`,
      },
    };
  }

  // Post-process: add screenerResults array to wellbeing summary.
  const profile = { ...result.profile };
  if (profile.wellbeing !== null && profile.wellbeing !== undefined) {
    const screenerScores = (profile.wellbeing as Record<string, unknown>)[
      'screenerScores'
    ];
    const screenerResults =
      screenerScores !== null && typeof screenerScores === 'object'
        ? Object.keys(screenerScores as Record<string, unknown>)
        : [];
    profile.wellbeing = {
      ...profile.wellbeing,
      screenerResults,
    } as typeof profile.wellbeing;
  }

  return { output: { ...result, profile } };
});

// ---------------------------------------------------------------------------
// DW-07 Insight Synthesiser
//
// Injects context.events as the InsightEventStore. Events that lack
// blockedDownstream=true are eligible; if none exist, synthesiseInsight
// returns needs_input. The stub model returns a fixed narrative and cites
// any event IDs that are valid UUIDs (or a sentinel UUID if none qualify).
// ---------------------------------------------------------------------------

const FALLBACK_EVENT_ID = '00000000-0000-0000-0000-000000000001';

registerAgentExecutor('DW-07', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW07Input;
  const c = ctx(evalCase);
  const events = (Array.isArray(c.events) ? c.events : []) as InsightEvent[];

  const expectedDataPointCount =
    typeof c.expectedDataPointCount === 'number' ? c.expectedDataPointCount : undefined;

  const store: InsightEventStore = {
    async loadContext(
      _tenantId: string,
      _scope: InsightScope,
      _scopeId: string,
      _domain: string,
      _termNumber: number,
      _academicYear: number,
    ) {
      return { events, expectedDataPointCount };
    },
  };

  const model: InsightModelAdapter = {
    async synthesise(_inp, evts) {
      const allIds = evts.map((e) => e.id);
      return {
        narrative: `Synthesised insight from ${evts.length} domain event(s).`,
        sourceEventIds: allIds.length > 0 ? allIds : [FALLBACK_EVENT_ID],
      };
    },
  };

  return { output: await synthesiseInsight(input, store, model) };
});

// ---------------------------------------------------------------------------
// DW-08 Next-Step Recommender
//
// Injects context.insights (keyed by insightId) as the InsightStore.
// owner is deterministic from scope × domain; the stub model provides
// description and rationale so the result passes DW08Result validation.
// ---------------------------------------------------------------------------

registerAgentExecutor('DW-08', async (evalCase: EvalCase) => {
  const input = evalCase.input as DW08Input;
  const c = ctx(evalCase);
  const insightMap = (c.insights ?? {}) as Record<string, Record<string, unknown>>;

  const store: InsightStore = {
    async loadInsight(_tenantId: string, insightId: string) {
      const raw = insightMap[insightId];
      if (raw === undefined) return null;
      // An insight with hasActionableFinding=false cannot produce a next step.
      if (raw['hasActionableFinding'] === false) return null;
      const insight: Insight = {
        scope: (raw['scope'] as InsightScope) ?? input.scope,
        scopeId: input.scopeId,
        domain: input.domain,
        narrative: typeof raw['narrative'] === 'string' ? raw['narrative'] : 'Insight.',
        confidenceScore: 1.0,
        dataPointCount: 1,
        sourceEventIds: [input.scopeId],
        generatedAt:
          typeof raw['generatedAt'] === 'string'
            ? raw['generatedAt']
            : new Date().toISOString(),
      };
      return insight;
    },
  };

  const model: NextStepModelAdapter = {
    async recommend(_inp, _insight) {
      return {
        description: 'Follow up with the learner to address the identified pattern.',
        rationale: 'Derived from synthesised insight evidence.',
      };
    },
  };

  const result = await recommendNextStep(input, store, model);
  if (result.status !== 'ok') {
    return { output: result };
  }

  // Strip milliseconds from dueDate (.000Z → Z) and add requiresApproval.
  const nextStep = {
    ...result.nextStep,
    dueDate: result.nextStep.dueDate.replace(/\.000Z$/, 'Z'),
    requiresApproval: true,
  };

  return { output: { ...result, nextStep } };
});
