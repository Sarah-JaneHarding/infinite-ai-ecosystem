// Stage 09 step 7 — DW-08 Next-Step Recommender unit tests.
//
// dueDate (insight.generatedAt + 7 days), owner (scope×domain lookup), and
// insightId (pass-through) are deterministic.  description and rationale come
// from the injected model stub so the unit tier runs without infrastructure.

import { describe, expect, it } from 'vitest';

import type { DW08Input } from '../../src/agent-inputs.js';
import type { Insight } from '../../src/types.js';
import type {
  InsightStore,
  NextStepModelAdapter,
  NextStepModelOutput,
} from '../../src/nextstep/nextstep-recommender.js';
import { recommendNextStep } from '../../src/nextstep/nextstep-recommender.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_ID = '00000000-0000-0000-0000-000000000100';
const INSIGHT_ID = '00000000-0000-0000-0000-000000000500';
const GENERATED_AT = '2026-08-07T10:00:00.000Z';
const DUE_DATE = '2026-08-14T10:00:00.000Z'; // exactly 7 days later

const baseInput: DW08Input = {
  tenantId: TENANT_ID,
  scope: 'LEARNER',
  scopeId: LEARNER_ID,
  domain: 'ATTENDANCE',
  insightId: INSIGHT_ID,
};

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    scope: 'LEARNER',
    scopeId: LEARNER_ID,
    domain: 'ATTENDANCE',
    narrative: 'The learner was absent 4 of 5 days last week.',
    confidenceScore: 0.8,
    dataPointCount: 5,
    sourceEventIds: ['00000000-0000-0000-0000-000000000010'],
    generatedAt: GENERATED_AT,
    ...overrides,
  };
}

function stubStore(insight: Insight | null): InsightStore {
  return {
    async loadInsight(): Promise<Insight | null> {
      return insight;
    },
  };
}

const STUB_DESCRIPTION = 'Contact guardian regarding attendance decline.';
const STUB_RATIONALE =
  'The learner was absent on 4 of 5 days, indicating urgent follow-up.';

const STUB_MODEL: NextStepModelAdapter = {
  async recommend(): Promise<NextStepModelOutput> {
    return {
      description: STUB_DESCRIPTION,
      rationale: STUB_RATIONALE,
    };
  },
};

// ---------------------------------------------------------------------------
// needs_input — no insight found
// ---------------------------------------------------------------------------

describe('recommendNextStep — needs_input', () => {
  it('returns needs_input when no insight is found', async () => {
    const result = await recommendNextStep(baseInput, stubStore(null), STUB_MODEL);
    expect(result.status).toBe('needs_input');
  });

  it('detail string contains the missing insightId', async () => {
    const result = await recommendNextStep(baseInput, stubStore(null), STUB_MODEL);
    if (result.status === 'needs_input') {
      expect(result.detail).toContain(INSIGHT_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// ok status — deterministic fields
// ---------------------------------------------------------------------------

describe('recommendNextStep — ok status, deterministic fields', () => {
  it('returns ok when insight is found', async () => {
    const result = await recommendNextStep(
      baseInput,
      stubStore(makeInsight()),
      STUB_MODEL,
    );
    expect(result.status).toBe('ok');
  });

  it('nextStep.insightId equals input.insightId', async () => {
    const result = await recommendNextStep(
      baseInput,
      stubStore(makeInsight()),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.insightId).toBe(INSIGHT_ID);
    }
  });

  it('nextStep.dueDate is exactly 7 days after insight.generatedAt', async () => {
    const result = await recommendNextStep(
      baseInput,
      stubStore(makeInsight()),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.dueDate).toBe(DUE_DATE);
    }
  });

  it('dueDate preserves time-of-day from generatedAt', async () => {
    const insight = makeInsight({ generatedAt: '2026-03-01T14:30:00.000Z' });
    const result = await recommendNextStep(baseInput, stubStore(insight), STUB_MODEL);
    if (result.status === 'ok') {
      expect(result.nextStep.dueDate).toBe('2026-03-08T14:30:00.000Z');
    }
  });
});

// ---------------------------------------------------------------------------
// ok status — owner resolution (scope × domain lookup)
// ---------------------------------------------------------------------------

describe('recommendNextStep — owner resolution', () => {
  it('LEARNER + ATTENDANCE → class teacher', async () => {
    const input: DW08Input = { ...baseInput, scope: 'LEARNER', domain: 'ATTENDANCE' };
    const result = await recommendNextStep(input, stubStore(makeInsight()), STUB_MODEL);
    if (result.status === 'ok') {
      expect(result.nextStep.owner).toBe('class teacher');
    }
  });

  it('CLASS + ASSESSMENT → HOD', async () => {
    const input: DW08Input = {
      ...baseInput,
      scope: 'CLASS',
      scopeId: '00000000-0000-0000-0000-000000000300',
      domain: 'ASSESSMENT',
    };
    const result = await recommendNextStep(
      input,
      stubStore(makeInsight({ scope: 'CLASS', domain: 'ASSESSMENT' })),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.owner).toBe('HOD');
    }
  });

  it('GRADE + BEHAVIOUR → deputy principal', async () => {
    const input: DW08Input = {
      ...baseInput,
      scope: 'GRADE',
      scopeId: '00000000-0000-0000-0000-000000000400',
      domain: 'BEHAVIOUR',
    };
    const result = await recommendNextStep(
      input,
      stubStore(makeInsight({ scope: 'GRADE', domain: 'BEHAVIOUR' })),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.owner).toBe('deputy principal');
    }
  });

  it('SCHOOL + WELLBEING → school psychologist', async () => {
    const input: DW08Input = {
      ...baseInput,
      scope: 'SCHOOL',
      scopeId: '00000000-0000-0000-0000-000000000001',
      domain: 'WELLBEING',
    };
    const result = await recommendNextStep(
      input,
      stubStore(makeInsight({ scope: 'SCHOOL', domain: 'WELLBEING' })),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.owner).toBe('school psychologist');
    }
  });
});

// ---------------------------------------------------------------------------
// ok status — model-generated fields
// ---------------------------------------------------------------------------

describe('recommendNextStep — model-generated fields', () => {
  it('nextStep.description comes from the model adapter', async () => {
    const result = await recommendNextStep(
      baseInput,
      stubStore(makeInsight()),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.description).toBe(STUB_DESCRIPTION);
    }
  });

  it('nextStep.rationale comes from the model adapter', async () => {
    const result = await recommendNextStep(
      baseInput,
      stubStore(makeInsight()),
      STUB_MODEL,
    );
    if (result.status === 'ok') {
      expect(result.nextStep.rationale).toBe(STUB_RATIONALE);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant store wiring
// ---------------------------------------------------------------------------

describe('recommendNextStep — multi-tenant store wiring', () => {
  it('passes the correct tenantId and insightId to the store', async () => {
    let capturedTenantId: string | null = null;
    let capturedInsightId: string | null = null;

    const capturingStore: InsightStore = {
      async loadInsight(tenantId, insightId): Promise<Insight | null> {
        capturedTenantId = tenantId;
        capturedInsightId = insightId;
        return null;
      },
    };

    const input: DW08Input = {
      tenantId: '00000000-0000-0000-0000-000000000002',
      scope: 'LEARNER',
      scopeId: LEARNER_ID,
      domain: 'ATTENDANCE',
      insightId: '00000000-0000-0000-0000-000000000999',
    };

    await recommendNextStep(input, capturingStore, STUB_MODEL);

    expect(capturedTenantId).toBe('00000000-0000-0000-0000-000000000002');
    expect(capturedInsightId).toBe('00000000-0000-0000-0000-000000000999');
  });
});
