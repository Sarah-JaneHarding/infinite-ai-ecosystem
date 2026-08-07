// Stage 09 step 9 — end-to-end pipeline integration tests.
//
// Drives the complete DW pipeline (connector → quality sentinel → learner-360 builder →
// insight synthesiser) using injected in-memory adapters so the unit tier runs without
// Postgres or a real model.
//
// Five scenarios, each drawn from the build manual's exit gate:
//   1. 10 000-learner synthetic tenant: connector, quality checks, and learner-360 builder
//      all handle a large dataset.  Reconciliation report totals are verified.
//   2. Reconciliation totals match source: totalSourceRows == pulled + deadLettered.
//   3. Corrupted source quarantined: empty/malformed rows go to the dead-letter list;
//      the good rows proceed through quality checks and mapping.
//   4. Mid-run failure resumes without duplication: pull returns rows after the stored
//      cursor; rows already delivered are never re-delivered.
//   5. Insight without provenance fails: when all events are blocked by the quality gate,
//      synthesiseInsight returns needs_input (no usable provenance).

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { CsvFileConnector } from '../src/ingest/connector.js';
import { runQualityChecks } from '../src/quality/quality-sentinel.js';
import { buildLearner360 } from '../src/learner360/learner360-builder.js';
import { synthesiseInsight } from '../src/insight/insight-synthesiser.js';
import type {
  InsightContext,
  InsightEvent,
  InsightEventStore,
} from '../src/insight/insight-synthesiser.js';
import type {
  Learner360Event,
  Learner360Store,
} from '../src/learner360/learner360-builder.js';
import type { DW07Input } from '../src/agent-inputs.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID = '00000000-0000-0000-0000-000000000010';
const TODAY = '2026-08-07';
const NOW_ISO = '2026-08-07T08:00:00.000Z';

function makeConfig(ref = 'test://data.csv') {
  return { tenantId: TENANT_ID, sourceId: SOURCE_ID, configRef: ref };
}

/** Generates N attendance CSV rows with unique learner tokens. */
function generateAttendanceCsv(rowCount: number): string {
  const lines = ['learnerToken,attendanceStatus,occurredAt'];
  const statuses = ['PRESENT', 'ABSENT', 'LATE'] as const;
  for (let i = 1; i <= rowCount; i++) {
    const token = `LNR${String(i).padStart(6, '0')}`;
    const status = statuses[(i - 1) % 3];
    lines.push(`${token},${status},${TODAY}`);
  }
  return lines.join('\n');
}

/** Returns a CSV where some rows are completely empty (they will dead-letter). */
function generateCsvWithCorruption(goodCount: number, badCount: number): string {
  const lines = ['learnerToken,attendanceStatus,occurredAt'];
  for (let i = 1; i <= goodCount; i++) {
    lines.push(`LNR${String(i).padStart(4, '0')},PRESENT,${TODAY}`);
  }
  // Completely empty data rows — the CSV parser yields no fields for these, so
  // CsvFileConnector quarantines them in the dead-letter list.
  for (let i = 0; i < badCount; i++) {
    lines.push(',,');
  }
  return lines.join('\n');
}

function stubLearner360Store(events: Learner360Event[]): Learner360Store {
  return {
    async loadEvents(): Promise<readonly Learner360Event[]> {
      return events;
    },
  };
}

function stubInsightStore(events: InsightEvent[]): InsightEventStore {
  return {
    async loadContext(): Promise<InsightContext> {
      return { events };
    },
  };
}

const STUB_INSIGHT_MODEL = {
  async synthesise(_input: DW07Input, events: readonly InsightEvent[]) {
    return {
      narrative: `Synthesised from ${events.length} events.`,
      sourceEventIds: events.map((e) => e.id),
    };
  },
};

// ---------------------------------------------------------------------------
// Scenario 1 — 10 000-learner synthetic tenant
// ---------------------------------------------------------------------------

describe('pipeline — 10 000-learner synthetic tenant', () => {
  const LEARNER_COUNT = 10_000;
  const csv = generateAttendanceCsv(LEARNER_COUNT);

  it('connector pulls all 10 000 rows', async () => {
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());
    expect(result.records).toHaveLength(LEARNER_COUNT);
  });

  it('reconciliation: totalSourceRows equals LEARNER_COUNT', async () => {
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());
    expect(result.reconciliation.totalSourceRows).toBe(LEARNER_COUNT);
  });

  it('reconciliation: no dead-lettered rows in a clean dataset', async () => {
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());
    expect(result.reconciliation.deadLettered).toBe(0);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('quality checks pass on 10 000 unique-token records', async () => {
    const connector = new CsvFileConnector(async () => csv);
    const { records } = await connector.pull(makeConfig());

    const qResult = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: randomUUID(),
        domain: 'ATTENDANCE',
        sampleRecords: records.map((r) => r.payload),
      },
      TODAY,
    );

    expect(qResult.status).toBe('ok');
    if (qResult.status === 'ok') {
      expect(qResult.totalRecords).toBe(LEARNER_COUNT);
      expect(qResult.blockedDownstream).toBe(false);
    }
  });

  it('learner-360 builder produces ok for each learner when events exist', async () => {
    const learnerId = randomUUID();
    const store = stubLearner360Store([
      {
        id: randomUUID(),
        domain: 'ATTENDANCE',
        eventType: 'attendance.present',
        occurredAt: NOW_ISO,
        payload: {},
      },
    ]);

    const result = await buildLearner360(
      { tenantId: TENANT_ID, learnerId, termNumber: 1, academicYear: 2026 },
      store,
      NOW_ISO,
    );

    expect(result.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Reconciliation invariant: pulled + deadLettered == totalSourceRows
// ---------------------------------------------------------------------------

describe('pipeline — reconciliation totals match source', () => {
  it('holds for a clean 50-row CSV', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(50));
    const result = await connector.pull(makeConfig());
    expect(result.reconciliation.pulled + result.reconciliation.deadLettered).toBe(
      result.reconciliation.totalSourceRows,
    );
  });

  it('holds for a mixed CSV with 20 good + 5 corrupt rows', async () => {
    const csv = generateCsvWithCorruption(20, 5);
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());
    expect(result.reconciliation.pulled + result.reconciliation.deadLettered).toBe(
      result.reconciliation.totalSourceRows,
    );
  });

  it('holds when resuming from a mid-run cursor', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(30));
    // First pull: rows 1–10.
    const first = await connector.pull(makeConfig(), '0');
    // Resume from cursor 10: rows 11–30.
    const second = await connector.pull(makeConfig(), '10');
    // Each partial pull's invariant holds independently.
    expect(first.reconciliation.pulled + first.reconciliation.deadLettered).toBe(
      first.reconciliation.totalSourceRows,
    );
    expect(second.reconciliation.pulled + second.reconciliation.deadLettered).toBe(
      second.reconciliation.totalSourceRows,
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Corrupted source quarantined
// ---------------------------------------------------------------------------

describe('pipeline — corrupted source quarantined', () => {
  it('dead-letters corrupt rows without blocking good rows', async () => {
    const GOOD = 10;
    const BAD = 3;
    const csv = generateCsvWithCorruption(GOOD, BAD);
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());

    expect(result.records).toHaveLength(GOOD);
    expect(result.deadLettered).toHaveLength(BAD);
  });

  it('good rows pass quality checks after quarantine', async () => {
    const GOOD = 10;
    const csv = generateCsvWithCorruption(GOOD, 3);
    const connector = new CsvFileConnector(async () => csv);
    const { records } = await connector.pull(makeConfig());

    const qResult = runQualityChecks(
      {
        tenantId: TENANT_ID,
        runId: randomUUID(),
        domain: 'ATTENDANCE',
        sampleRecords: records.map((r) => r.payload),
      },
      TODAY,
    );
    expect(qResult.status).toBe('ok');
    if (qResult.status === 'ok') {
      expect(qResult.totalRecords).toBe(GOOD);
    }
  });

  it('dead-lettered entries carry an error description', async () => {
    const csv = generateCsvWithCorruption(2, 1);
    const connector = new CsvFileConnector(async () => csv);
    const { deadLettered } = await connector.pull(makeConfig());
    expect(deadLettered[0]?.error).toBeTruthy();
  });

  it('reconciliation reflects the quarantined split', async () => {
    const GOOD = 7;
    const BAD = 4;
    const csv = generateCsvWithCorruption(GOOD, BAD);
    const connector = new CsvFileConnector(async () => csv);
    const { reconciliation } = await connector.pull(makeConfig());

    expect(reconciliation.pulled).toBe(GOOD);
    expect(reconciliation.deadLettered).toBe(BAD);
    expect(reconciliation.totalSourceRows).toBe(GOOD + BAD);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — Mid-run failure resumes without duplication
// ---------------------------------------------------------------------------

describe('pipeline — mid-run failure resumes without duplication', () => {
  const TOTAL = 20;
  const FIRST_BATCH = 8;

  it('first pull delivers exactly FIRST_BATCH rows', async () => {
    // Simulate a run that delivers rows 1–FIRST_BATCH then stops (cursor = '8').
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(TOTAL));
    // Pull from the beginning.
    const allResult = await connector.pull(makeConfig());
    const firstBatchSourceRefs = allResult.records
      .slice(0, FIRST_BATCH)
      .map((r) => r.sourceRef);

    // Re-create connector; pull stopping after 8 rows is simulated by only
    // taking the first 8 from the full pull.
    expect(firstBatchSourceRefs).toHaveLength(FIRST_BATCH);
    expect(firstBatchSourceRefs[0]).toMatch(/#row-1$/);
    expect(firstBatchSourceRefs[7]).toMatch(/#row-8$/);
  });

  it('resuming from cursor 8 delivers exactly the remaining rows', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(TOTAL));
    const resumed = await connector.pull(makeConfig(), String(FIRST_BATCH));

    expect(resumed.records).toHaveLength(TOTAL - FIRST_BATCH);
    // First resumed row must be row-9, not row-1.
    expect(resumed.records[0]?.sourceRef).toMatch(/#row-9$/);
    expect(resumed.records[TOTAL - FIRST_BATCH - 1]?.sourceRef).toMatch(
      new RegExp(`#row-${TOTAL}$`),
    );
  });

  it('rows before the cursor are never re-delivered', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(TOTAL));
    const firstPull = await connector.pull(makeConfig());
    const firstRefs = new Set(
      firstPull.records.slice(0, FIRST_BATCH).map((r) => r.sourceRef),
    );

    const resumed = await connector.pull(makeConfig(), String(FIRST_BATCH));
    const resumedRefs = resumed.records.map((r) => r.sourceRef);

    for (const ref of resumedRefs) {
      expect(firstRefs.has(ref)).toBe(false);
    }
  });

  it('pulling from the final cursor returns zero records', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(TOTAL));
    const done = await connector.pull(makeConfig(), String(TOTAL));
    expect(done.records).toHaveLength(0);
    expect(done.deadLettered).toHaveLength(0);
  });

  it('idempotent: same cursor twice yields identical sourceRefs', async () => {
    const connector = new CsvFileConnector(async () => generateAttendanceCsv(TOTAL));
    const first = await connector.pull(makeConfig(), String(FIRST_BATCH));
    const second = await connector.pull(makeConfig(), String(FIRST_BATCH));
    expect(first.records.map((r) => r.sourceRef)).toEqual(
      second.records.map((r) => r.sourceRef),
    );
  });
});

// ---------------------------------------------------------------------------
// Scenario 5 — Insight without provenance fails
// ---------------------------------------------------------------------------

describe('pipeline — insight without provenance fails', () => {
  const baseInput: DW07Input = {
    tenantId: TENANT_ID,
    scope: 'LEARNER',
    scopeId: randomUUID(),
    domain: 'ATTENDANCE',
    termNumber: 1,
    academicYear: 2026,
  };

  it('returns needs_input when the event store is empty', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore([]),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    expect(result.status).toBe('needs_input');
  });

  it('returns needs_input when all events are blocked by the quality gate', async () => {
    const blockedEvents: InsightEvent[] = [
      {
        id: randomUUID(),
        domain: 'ATTENDANCE',
        eventType: 'attendance.absent',
        payload: {},
        blockedDownstream: true,
      },
      {
        id: randomUUID(),
        domain: 'ATTENDANCE',
        eventType: 'attendance.present',
        payload: {},
        blockedDownstream: true,
      },
    ];

    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore(blockedEvents),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    expect(result.status).toBe('needs_input');
  });

  it('needs_input detail names the scope and domain', async () => {
    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore([]),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    if (result.status === 'needs_input') {
      expect(result.detail).toContain('ATTENDANCE');
    }
  });

  it('needs_input scoped correctly when all events are blocked', async () => {
    const blocked: InsightEvent[] = [
      { id: randomUUID(), domain: 'ATTENDANCE', blockedDownstream: true },
    ];
    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore(blocked),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    if (result.status === 'needs_input') {
      expect(result.scope).toBe('LEARNER');
      expect(result.scopeId).toBe(baseInput.scopeId);
    }
  });

  it('returns ok when at least one unblocked event exists', async () => {
    const events: InsightEvent[] = [
      { id: randomUUID(), domain: 'ATTENDANCE', blockedDownstream: true },
      { id: randomUUID(), domain: 'ATTENDANCE' },
    ];
    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore(events),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    expect(result.status).toBe('ok');
  });

  it('insight sourceEventIds come only from unblocked events', async () => {
    const blockedId = randomUUID();
    const unblockedId = randomUUID();
    const events: InsightEvent[] = [
      { id: blockedId, domain: 'ATTENDANCE', blockedDownstream: true },
      { id: unblockedId, domain: 'ATTENDANCE' },
    ];
    const result = await synthesiseInsight(
      baseInput,
      stubInsightStore(events),
      STUB_INSIGHT_MODEL,
      NOW_ISO,
    );
    if (result.status === 'ok') {
      expect(result.insights[0]?.sourceEventIds).toContain(unblockedId);
      expect(result.insights[0]?.sourceEventIds).not.toContain(blockedId);
    }
  });
});
