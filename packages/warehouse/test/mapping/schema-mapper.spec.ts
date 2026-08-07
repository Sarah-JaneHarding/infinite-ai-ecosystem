import { describe, expect, it, vi } from 'vitest';

import type { MappingStore } from '../../src/mapping/schema-mapper.js';
import { mapRecord } from '../../src/mapping/schema-mapper.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID = '00000000-0000-0000-0000-000000000010';
const RAW_RECORD_ID = '00000000-0000-0000-0000-000000000020';
const RUN_ID = '00000000-0000-0000-0000-000000000030';

function baseInput(
  overrides: Partial<{
    sourceFields: Record<string, unknown>;
    targetDomain:
      | 'ATTENDANCE'
      | 'ASSESSMENT'
      | 'BEHAVIOUR'
      | 'WELLBEING'
      | 'DEMOGRAPHIC'
      | 'SCREENER';
    connectorKind: string;
  }> = {},
) {
  return {
    tenantId: TENANT_ID,
    runId: RUN_ID,
    rawRecordId: RAW_RECORD_ID,
    sourceId: SOURCE_ID,
    connectorKind: overrides.connectorKind ?? 'SIS_API',
    sourceFields: overrides.sourceFields ?? {
      id: 'L001',
      status: 'PRESENT',
      date: '2026-07-15',
    },
    targetDomain: overrides.targetDomain ?? 'ATTENDANCE',
  };
}

function confirmedMappings(
  entries: Array<{ s: string; c: string; transform?: string }>,
): MappingStore {
  const save = vi.fn().mockResolvedValue(undefined);
  return {
    loadMappings: vi.fn().mockResolvedValue(
      entries.map(({ s, c, transform }) => ({
        sourceField: s,
        canonicalField: c,
        confirmed: true,
        transformName: transform,
      })),
    ),
    saveUnconfirmedMappings: save,
  };
}

function noMappings(): MappingStore {
  return {
    loadMappings: vi.fn().mockResolvedValue([]),
    saveUnconfirmedMappings: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Happy path — all fields mapped and confirmed
// ---------------------------------------------------------------------------

describe('mapRecord — ok status', () => {
  it('returns ok when every source field has a confirmed mapping', async () => {
    // eventType must also be present or derived — add it as a source field
    const input = baseInput({
      sourceFields: { id: 'L001', status: 'PRESENT', date: '2026-07-15', type: 'DAILY' },
    });
    const extStore = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'status', c: 'attendanceStatus' },
      { s: 'date', c: 'occurredAt' },
      { s: 'type', c: 'eventType' },
    ]);

    const result = await mapRecord(input, extStore);

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.learnerId).toBe('L001');
      expect(result.eventType).toBe('DAILY');
      expect(result.occurredAt).toBe('2026-07-15');
      expect(result.canonicalPayload).toMatchObject({
        learnerId: 'L001',
        attendanceStatus: 'PRESENT',
        occurredAt: '2026-07-15',
        eventType: 'DAILY',
      });
      expect(result.mappingsApplied).toHaveLength(4);
    }
  });

  it('includes all source→canonical pairs in mappingsApplied', async () => {
    const input = baseInput({
      sourceFields: { sid: 'L002', evt: 'ABSENT', dt: '2026-07-16', kind: 'DAILY' },
    });
    const store = confirmedMappings([
      { s: 'sid', c: 'learnerId' },
      { s: 'evt', c: 'attendanceStatus' },
      { s: 'dt', c: 'occurredAt' },
      { s: 'kind', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      const sources = result.mappingsApplied.map((m) => m.sourceField);
      expect(sources).toContain('sid');
      expect(sources).toContain('evt');
    }
  });

  it('applies a named transform function when one is registered', async () => {
    const input = baseInput({
      sourceFields: {
        id: 'L003',
        date_raw: '15/07/2026',
        evt_type: 'DAILY',
      },
    });
    const store = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'date_raw', c: 'occurredAt', transform: 'dmy_to_iso' },
      { s: 'evt_type', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store, {
      dmy_to_iso: (v) => {
        const [d, m, y] = v.split('/');
        return `${y}-${m}-${d}`;
      },
    });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.occurredAt).toBe('2026-07-15');
      expect(result.canonicalPayload['occurredAt']).toBe('2026-07-15');
    }
  });

  it('leaves an unknown transform name as a pass-through (transform not in registry)', async () => {
    const input = baseInput({
      sourceFields: { id: 'L004', dt: '2026-07-15', kind: 'LATE' },
    });
    const store = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'dt', c: 'occurredAt', transform: 'unknown_transform' },
      { s: 'kind', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store, {});
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // Value passes through unchanged when transform is not found
      expect(result.canonicalPayload['occurredAt']).toBe('2026-07-15');
    }
  });

  it('does not include raw learnerId UUID in canonicalPayload if field was renamed', async () => {
    const input = baseInput({
      sourceFields: { learner_no: 'L005', dt: '2026-07-15', kind: 'DAILY' },
    });
    const store = confirmedMappings([
      { s: 'learner_no', c: 'learnerId' },
      { s: 'dt', c: 'occurredAt' },
      { s: 'kind', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // The source field name should not appear as a key in the canonical payload
      expect(Object.keys(result.canonicalPayload)).not.toContain('learner_no');
    }
  });
});

// ---------------------------------------------------------------------------
// needs_input — unmapped or unconfirmed fields
// ---------------------------------------------------------------------------

describe('mapRecord — needs_input status', () => {
  it('returns needs_input when no mappings exist for the source', async () => {
    const store = noMappings();
    const result = await mapRecord(baseInput(), store);

    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields).toContain('id');
      expect(result.unmappedFields).toContain('status');
      expect(result.unmappedFields).toContain('date');
    }
  });

  it('lists all unmapped fields in unmappedFields', async () => {
    const store = noMappings();
    const input = baseInput({
      sourceFields: { a: '1', b: '2', c: '3' },
    });
    const result = await mapRecord(input, store);

    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields.sort()).toEqual(['a', 'b', 'c'].sort());
    }
  });

  it('returns needs_input when a mapping exists but is not confirmed', async () => {
    const store: MappingStore = {
      loadMappings: vi.fn().mockResolvedValue([
        { sourceField: 'id', canonicalField: 'learnerId', confirmed: false },
        { sourceField: 'date', canonicalField: 'occurredAt', confirmed: false },
      ]),
      saveUnconfirmedMappings: vi.fn().mockResolvedValue(undefined),
    };

    const result = await mapRecord(baseInput(), store);
    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields).toContain('id');
    }
  });

  it('calls saveUnconfirmedMappings for newly discovered fields', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const store: MappingStore = {
      loadMappings: vi.fn().mockResolvedValue([]),
      saveUnconfirmedMappings: saveFn,
    };

    await mapRecord(
      baseInput({ sourceFields: { newField: 'value', anotherNew: '42' } }),
      store,
    );

    expect(saveFn).toHaveBeenCalledWith(
      TENANT_ID,
      SOURCE_ID,
      'SIS_API',
      expect.arrayContaining([
        { sourceField: 'newField' },
        { sourceField: 'anotherNew' },
      ]),
    );
  });

  it('returns needs_input when learnerId is missing from the canonical result', async () => {
    const input = baseInput({
      sourceFields: { dt: '2026-07-15', kind: 'DAILY' },
    });
    const store = confirmedMappings([
      { s: 'dt', c: 'occurredAt' },
      { s: 'kind', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields).toContain('learnerId');
    }
  });

  it('returns needs_input when occurredAt is missing from the canonical result', async () => {
    const input = baseInput({
      sourceFields: { id: 'L006', kind: 'DAILY' },
    });
    const store = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'kind', c: 'eventType' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields).toContain('occurredAt');
    }
  });

  it('returns needs_input when eventType is missing from the canonical result', async () => {
    const input = baseInput({
      sourceFields: { id: 'L007', dt: '2026-07-15' },
    });
    const store = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'dt', c: 'occurredAt' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('needs_input');
    if (result.status === 'needs_input') {
      expect(result.unmappedFields).toContain('eventType');
    }
  });
});

// ---------------------------------------------------------------------------
// rejected — domain mismatch
// ---------------------------------------------------------------------------

describe('mapRecord — rejected status', () => {
  it('returns rejected when a mapped domain field conflicts with targetDomain', async () => {
    const input = baseInput({
      sourceFields: {
        id: 'L008',
        dt: '2026-07-15',
        kind: 'DAILY',
        src_domain: 'BEHAVIOUR',
      },
      targetDomain: 'ATTENDANCE',
    });
    const store = confirmedMappings([
      { s: 'id', c: 'learnerId' },
      { s: 'dt', c: 'occurredAt' },
      { s: 'kind', c: 'eventType' },
      { s: 'src_domain', c: 'domain' },
    ]);

    const result = await mapRecord(input, store);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toMatch(/BEHAVIOUR/);
      expect(result.reason).toMatch(/ATTENDANCE/);
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-tenant isolation
// ---------------------------------------------------------------------------

describe('mapRecord — multi-tenant isolation', () => {
  it('passes the correct tenantId to the store', async () => {
    const loadFn = vi.fn().mockResolvedValue([]);
    const store: MappingStore = {
      loadMappings: loadFn,
      saveUnconfirmedMappings: vi.fn().mockResolvedValue(undefined),
    };

    const input = {
      ...baseInput(),
      tenantId: '00000000-0000-0000-0000-000000000099',
    };
    await mapRecord(input, store);

    expect(loadFn).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000099',
      SOURCE_ID,
      'SIS_API',
    );
  });

  it('different tenantIds call the store independently', async () => {
    const loadFn = vi.fn().mockResolvedValue([]);
    const store: MappingStore = {
      loadMappings: loadFn,
      saveUnconfirmedMappings: vi.fn().mockResolvedValue(undefined),
    };

    await mapRecord(
      { ...baseInput(), tenantId: '00000000-0000-0000-0000-000000000001' },
      store,
    );
    await mapRecord(
      { ...baseInput(), tenantId: '00000000-0000-0000-0000-000000000002' },
      store,
    );

    expect(loadFn).toHaveBeenCalledTimes(2);
    const firstTenant = (loadFn.mock.calls[0] as unknown[])[0];
    const secondTenant = (loadFn.mock.calls[1] as unknown[])[0];
    expect(firstTenant).not.toBe(secondTenant);
  });
});
