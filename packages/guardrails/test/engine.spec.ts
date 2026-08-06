// The guardrail engine's composition — Stage 06 step 6.

import type { ConsentEntry, DataCategory } from '@infinite-ai/contracts';
import type { AccessRequest } from '@infinite-ai/policy';
import type { TenantLexicon } from '@infinite-ai/deident';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { createTracer } from '@infinite-ai/telemetry';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  defaultEscalationNotifier,
  runInputGuardrails,
  runOutputGuardrails,
  GuardrailEscalationError,
  type InputGuardrailInput,
  type OutputGuardrailInput,
} from '../src/engine.js';
import { refuse } from '../src/refusal.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const LEARNER = 'LNR_7F3A2C0B91DE';
const AT = new Date('2026-06-01T00:00:00.000Z');
const EARLIER = new Date('2026-01-15T08:00:00.000Z');
const LEXICON: TenantLexicon = { personNames: [], schoolNames: [] };

function grant(category: DataCategory, purpose: ConsentEntry['purpose']): ConsentEntry {
  return {
    id: 'bbbbbbbb-0000-4000-8000-000000000001',
    tenantId: TENANT,
    subjectToken: LEARNER,
    category,
    purpose,
    basis: 'PUBLIC_LAW_DUTY',
    decision: 'GRANTED',
    source: 'NOT_APPLICABLE',
    evidenceRef: null,
    effectiveFrom: EARLIER,
    recordedAt: EARLIER,
    recordedBy: null,
    note: null,
  };
}

function validAccess(): AccessRequest {
  return {
    purpose: 'screening',
    subjectToken: LEARNER,
    requested: ['ATTENDANCE'],
    ledger: [grant('ATTENDANCE', 'screening')],
    tombstonedAt: null,
    at: AT,
  };
}

function validInput(over: Partial<InputGuardrailInput> = {}): InputGuardrailInput {
  return {
    inputSchema: z.object({ learnerId: z.string().min(1) }),
    input: { learnerId: 'L1' },
    access: validAccess(),
    requiredCategories: ['ATTENDANCE'],
    egress: {
      tenantId: TENANT,
      texts: ['Plan a lesson on fractions for Grade 6.'],
      provenance: { deidentified: true, saltVersion: 1, dropped: [] },
    },
    lexicon: LEXICON,
    tokenBudget: { maxTokens: 1000 },
    ...over,
  };
}

function validOutput(over: Partial<OutputGuardrailInput> = {}): OutputGuardrailInput {
  return {
    outputSchema: z.object({ summary: z.string().min(1) }),
    output: { summary: 'A short, readable summary.' },
    citedIds: [],
    validCitationIds: new Set<string>(),
    readabilityText: 'The cat sat on the mat.',
    // Flesch-Kincaid legitimately scores very short, simple sentences below zero — this
    // is the formula's own real behaviour, not a defect; the range here is wide enough to
    // treat "The cat sat on the mat." as acceptable for any audience.
    readabilityRange: { minGrade: -5, maxGrade: 12 },
    actualCostUsd: 0.01,
    costBudget: { maxCostUsd: 1 },
    claimedRefusal: null,
    ...over,
  };
}

describe('runInputGuardrails', () => {
  it('passes when every check passes', async () => {
    const verdict = await runInputGuardrails(validInput());
    expect(verdict.passed).toBe(true);
  });

  it('stops at the first failing check, in the manual’s own order', async () => {
    // Both the schema and the PII provenance are invalid; schema runs first.
    const verdict = await runInputGuardrails(
      validInput({ input: {}, egress: { tenantId: TENANT, texts: ['x'] } }),
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('invalid_input_schema');
  });

  it('reaches the PII check once the schema and purpose/consent checks pass', async () => {
    const verdict = await runInputGuardrails(
      validInput({ egress: { tenantId: TENANT, texts: ['x'] } }),
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('missing_provenance');
  });

  it('emits one trace span for the whole phase', async () => {
    const exporter = new InMemorySpanExporter();
    const tracer = createTracer({
      serviceName: 'test-guardrails',
      spanProcessor: new SimpleSpanProcessor(exporter),
    });
    await runInputGuardrails(validInput(), { tracer });
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('guardrails.input');
  });
});

describe('runOutputGuardrails', () => {
  it('passes when every check passes', async () => {
    const verdict = await runOutputGuardrails(validOutput());
    expect(verdict.passed).toBe(true);
  });

  it('refuses a dangling citation', async () => {
    const verdict = await runOutputGuardrails(
      validOutput({ citedIds: ['fact-does-not-exist'] }),
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('ungrounded_claim');
  });

  it('refuses a malformed claimed refusal', async () => {
    const verdict = await runOutputGuardrails(
      validOutput({ claimedRefusal: { code: 'not_real', explanation: '' } }),
    );
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) expect(verdict.refusal.code).toBe('invalid_refusal');
  });
});

describe('escalation', () => {
  it('is never invoked when a refusal carries no escalation route', async () => {
    let called = false;
    const verdict = await runInputGuardrails(validInput({ input: {} }), {
      notify: () => {
        called = true;
      },
    });
    expect(verdict.passed).toBe(false);
    expect(called).toBe(false);
  });

  it('is awaited before the refusal is returned when one is present', async () => {
    // None of this engine's own built-in checks ever set an escalation route (see
    // engine.ts's own header — nothing mechanical here is a safeguarding concern), so the
    // injectable age-appropriateness checker is what stands in for a real one that would
    // detect a safeguarding concern and attach a route.
    const order: string[] = [];
    const verdict = await runOutputGuardrails(
      validOutput({
        ageAppropriatenessChecker: () =>
          refuse('age_inappropriate', 'Needs a human, now.', {
            category: 'unspecified_concern',
            notifyRole: 'sbst',
          }),
      }),
      {
        notify: async (route) => {
          order.push(`notified:${route.notifyRole}`);
        },
      },
    );
    expect(verdict.passed).toBe(false);
    expect(order).toEqual(['notified:sbst']);
  });

  it('defaultEscalationNotifier throws rather than silently no-op when nothing real is wired', async () => {
    await expect(
      runOutputGuardrails(
        validOutput({
          ageAppropriatenessChecker: () =>
            refuse('age_inappropriate', 'Needs a human, now.', {
              category: 'unspecified_concern',
              notifyRole: 'sbst',
            }),
        }),
      ),
    ).rejects.toThrow(GuardrailEscalationError);
  });

  it('the default notifier throws directly when called on its own', () => {
    expect(() =>
      defaultEscalationNotifier(
        { category: 'unspecified_concern', notifyRole: 'sbst' },
        { code: 'age_inappropriate', explanation: 'x', escalation: null },
      ),
    ).toThrow(GuardrailEscalationError);
  });
});
