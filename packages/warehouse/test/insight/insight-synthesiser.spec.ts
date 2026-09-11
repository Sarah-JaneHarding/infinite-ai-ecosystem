// Stage 09 step 7 — DW-07 Insight Synthesiser unit tests.
//
// All deterministic paths (needs_input, confidence score, metadata assembly)
// are covered without a real model. The injected model stub returns a fixed
// narrative so the unit tier runs without infrastructure.

import { describe, expect, it } from 'vitest';

import type { DW07Input } from '../../src/agent-inputs.js';
import type { InsightScope, DataDomain } from '../../src/types.js';
import type {
  InsightEventStore,
  InsightModelAdapter,
  InsightContext,
  InsightEvent,
  InsightModelOutput,
} from '../../src/insight/insight-synthesiser.js';
import { synthesiseInsight } from '../../src/insight/insight-synthesiser.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const LEARNER_ID = '00000000-0000-0000-0000-000000000100';
const NOW = '2026-08-07T08:00:00.000Z';

const baseInput: DW07Input = {
  tenantId: TENANT_ID,
  scope: 'LEARNER',
  scopeId: LEARNER_ID,
  domain: 'ATTENDANCE',
  termNumber: 1,
  academicYear: 2026,
};

function makeEvent(id: string, blocked = false): InsightEvent {
  return {
    id,
    domain: 'ATTENDANCE',
    eventType: 'attendance.present',
    payload: { attendanceStatus: 'PRESENT' },
    ...(blocked ? { blockedDownstream: true as const } : {}),
  };
}

function stubStore(
  events: InsightEvent[],
  expectedDataPointCount?: number,
): InsightEventStore {
  return {
    async loadContext(): Promise<InsightContext> {
      return {
        events,
        ...(expectedDataPointCount !== undefined ? { expectedDataPointCount } : {}),
      };
    },
  };
}

const STUB_NARRATIVE = 'The learner was present for most of the term.';
const STUB_EVENT_ID = '00000000-0000-0000-0000-000000000010';

function stubModel(eventIds: string[] = [STUB_EVENT_ID]): InsightModelAdapter {
  return {
    async synthesise(): Promise<InsightModelOutput> {
      return {
        narrative: STUB_NARRATIVE,
        sourceEventIds: eventIds,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// needs_input — no events
// ---------------------------------------------------------------------------

describe('synthesiseInsight — needs_input (no events)', () => {
  it('returns needs_input when the store returns no events', async () => {
    const result = await synthesiseInsight(baseInput, stubStore([]), stubModel(), NOW);
    expect(result.status).toBe('needs_input');
  });

  it('passes the correct scope and scopeId in needs_input response', async () => {
    const result = await synthesiseInsight(baseInput, stubStore([]), stubModel(), NOW);
    if (result.status === 'needs_input') {
      expect(result.scope).toBe('LEARNER');
      expect(result.scopeId).toBe(LEARNER_ID);
    }
  });

  it('includes a non-empty detail string', async () => {
    const result = await synthesiseInsight(baseInput, stubStore([]), stubModel(), NOW);
    if (result.status === 'needs_input') {
      expect(result.detail.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// needs_input — all events blocked
// ---------------------------------------------------------------------------

describe('synthesiseInsight — needs_input (all blocked)', () => {
  it('returns needs_input when all events are blocked', async () => {
    const events = [makeEvent('evt-001', true), makeEvent('evt-002', true)];
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events),
      stubModel(),
      NOW,
    );
    expect(result.status).toBe('needs_input');
  });

  it('returns needs_input with correct scope when all events are blocked', async () => {
    const events = [makeEvent('evt-001', true)];
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events),
      stubModel(),
      NOW,
    );
    if (result.status === 'needs_input') {
      expect(result.scope).toBe('LEARNER');
      expect(result.scopeId).toBe(LEARNER_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// ok status — metadata assembly
// ---------------------------------------------------------------------------

describe('synthesiseInsight — ok status, insight metadata', () => {
  it('returns ok when unblocked events are present', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    expect(result.status).toBe('ok');
  });

  it('insight.scope matches input.scope', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.scope).toBe('LEARNER');
    }
  });

  it('insight.scopeId matches input.scopeId', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.scopeId).toBe(LEARNER_ID);
    }
  });

  it('insight.domain matches input.domain', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.domain).toBe('ATTENDANCE');
    }
  });

  it('insight.generatedAt matches injected now', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.generatedAt).toBe(NOW);
    }
  });

  it('insight.narrative comes from the model adapter', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.narrative).toBe(STUB_NARRATIVE);
    }
  });

  it('insight.sourceEventIds comes from the model adapter', async () => {
    const eventId = '00000000-0000-0000-0000-000000000099';
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('evt-001')]),
      stubModel([eventId]),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.sourceEventIds).toEqual([eventId]);
    }
  });
});

// ---------------------------------------------------------------------------
// ok status — data point count and confidence score
// ---------------------------------------------------------------------------

describe('synthesiseInsight — dataPointCount and confidenceScore', () => {
  it('dataPointCount = number of unblocked events', async () => {
    const events = [makeEvent('e1'), makeEvent('e2'), makeEvent('e3')];
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.dataPointCount).toBe(3);
    }
  });

  it('confidenceScore = 1 when expectedDataPointCount is not provided', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubStore([makeEvent('e1'), makeEvent('e2')]),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.confidenceScore).toBe(1);
    }
  });

  it('confidenceScore = events / expected when expected is provided', async () => {
    // 5 events / 10 expected = 0.5
    const events = Array.from({ length: 5 }, (_, i) => makeEvent(`e${i}`));
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events, 10),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.confidenceScore).toBe(0.5);
    }
  });

  it('confidenceScore is clamped to 1 when events > expected', async () => {
    // 10 events / 5 expected → clamped to 1
    const events = Array.from({ length: 10 }, (_, i) => makeEvent(`e${i}`));
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events, 5),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.confidenceScore).toBe(1);
    }
  });

  it('blocked events are excluded from dataPointCount', async () => {
    // 3 unblocked + 2 blocked → dataPointCount = 3
    const events = [
      makeEvent('e1'),
      makeEvent('e2'),
      makeEvent('e3'),
      makeEvent('e4', true),
      makeEvent('e5', true),
    ];
    const result = await synthesiseInsight(
      baseInput,
      stubStore(events),
      stubModel(),
      NOW,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.dataPointCount).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Model adapter receives only unblocked events
// ---------------------------------------------------------------------------

describe('synthesiseInsight — model receives unblocked events only', () => {
  it('only unblocked events are passed to the model', async () => {
    let receivedCount = 0;
    const capturingModel: InsightModelAdapter = {
      async synthesise(_input, events): Promise<InsightModelOutput> {
        receivedCount = events.length;
        return { narrative: 'stub', sourceEventIds: [STUB_EVENT_ID] };
      },
    };

    const allEvents = [makeEvent('e1'), makeEvent('e2'), makeEvent('e3', true)];
    await synthesiseInsight(baseInput, stubStore(allEvents), capturingModel, NOW);
    expect(receivedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant store wiring
// ---------------------------------------------------------------------------

describe('synthesiseInsight — multi-tenant store wiring', () => {
  it('passes the correct tenantId, scope, scopeId, domain, term to the store', async () => {
    let capturedTenantId: string | null = null;
    let capturedScope: InsightScope | null = null;
    let capturedScopeId: string | null = null;
    let capturedDomain: DataDomain | null = null;
    let capturedTermNumber: number | null = null;
    let capturedAcademicYear: number | null = null;

    const capturingStore: InsightEventStore = {
      async loadContext(
        tenantId,
        scope,
        scopeId,
        domain,
        termNumber,
        academicYear,
      ): Promise<InsightContext> {
        capturedTenantId = tenantId;
        capturedScope = scope;
        capturedScopeId = scopeId;
        capturedDomain = domain;
        capturedTermNumber = termNumber;
        capturedAcademicYear = academicYear;
        return { events: [] };
      },
    };

    const input: DW07Input = {
      tenantId: '00000000-0000-0000-0000-000000000002',
      scope: 'CLASS',
      scopeId: '00000000-0000-0000-0000-000000000300',
      domain: 'ASSESSMENT',
      termNumber: 2,
      academicYear: 2025,
    };

    await synthesiseInsight(input, capturingStore, stubModel(), NOW);

    expect(capturedTenantId).toBe('00000000-0000-0000-0000-000000000002');
    expect(capturedScope).toBe('CLASS');
    expect(capturedScopeId).toBe('00000000-0000-0000-0000-000000000300');
    expect(capturedDomain).toBe('ASSESSMENT');
    expect(capturedTermNumber).toBe(2);
    expect(capturedAcademicYear).toBe(2025);
  });
});
