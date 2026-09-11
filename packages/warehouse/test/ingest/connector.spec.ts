import { describe, expect, it } from 'vitest';

import {
  AttendanceApiConnector,
  BehaviourApiConnector,
  CsvFileConnector,
  FileConnector,
  ManualUploadConnector,
  ScreenerApiConnector,
  SisApiConnector,
  getConnector,
} from '../../src/ingest/connector.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const SOURCE_ID = '00000000-0000-0000-0000-000000000010';

function makeConfig(ref = 'test://attendance.csv') {
  return { tenantId: TENANT_ID, sourceId: SOURCE_ID, configRef: ref };
}

const SAMPLE_CSV = `learnerId,attendanceStatus,occurredAt
L001,PRESENT,2026-07-15
L002,ABSENT,2026-07-15
L003,LATE,2026-07-15`;

// ---------------------------------------------------------------------------
// CsvFileConnector
// ---------------------------------------------------------------------------

describe('CsvFileConnector', () => {
  it('parses CSV content into RawRecord objects', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const result = await connector.pull(makeConfig());

    expect(result.records).toHaveLength(3);
    expect(result.records[0]).toMatchObject({
      sourceRef: 'test://attendance.csv#row-1',
      payload: {
        learnerId: 'L001',
        attendanceStatus: 'PRESENT',
        occurredAt: '2026-07-15',
      },
    });
    expect(result.hasMore).toBe(false);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('sets cursor to the last row index after a full pull', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const result = await connector.pull(makeConfig());
    expect(result.cursor).toBe('3');
  });

  it('resumes from cursor — only returns rows after the stored position', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const result = await connector.pull(makeConfig(), '1');

    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.payload).toMatchObject({ learnerId: 'L002' });
    expect(result.records[1]?.payload).toMatchObject({ learnerId: 'L003' });
  });

  it('returns empty records when cursor is already at the end', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const result = await connector.pull(makeConfig(), '3');

    expect(result.records).toHaveLength(0);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('is idempotent: same cursor + same content → same records', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const first = await connector.pull(makeConfig(), '1');
    const second = await connector.pull(makeConfig(), '1');

    expect(first.records.map((r) => r.sourceRef)).toEqual(
      second.records.map((r) => r.sourceRef),
    );
    expect(first.records.map((r) => r.payload)).toEqual(
      second.records.map((r) => r.payload),
    );
  });

  it('returns empty results for a header-only CSV', async () => {
    const connector = new CsvFileConnector(async () => 'col1,col2\n');
    const result = await connector.pull(makeConfig());

    expect(result.records).toHaveLength(0);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('returns empty results for completely empty content', async () => {
    const connector = new CsvFileConnector(async () => '');
    const result = await connector.pull(makeConfig());

    expect(result.records).toHaveLength(0);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('reconciliation totals: pulled + deadLettered = totalSourceRows after cursor', async () => {
    const csv = `id,val\n1,a\n2,b\n3,c\n4,d`;
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig(), '1');

    const { totalSourceRows, pulled, deadLettered: dl } = result.reconciliation;
    expect(totalSourceRows).toBe(4);
    expect(pulled).toBe(3);
    expect(dl).toBe(0);
    expect(result.deadLettered).toHaveLength(0);
  });

  it('reconciliation: totalSourceRows reflects the whole file, not just what is pending', async () => {
    const connector = new CsvFileConnector(async () => SAMPLE_CSV);
    const result = await connector.pull(makeConfig(), '2');
    expect(result.reconciliation.totalSourceRows).toBe(3);
    expect(result.reconciliation.pulled).toBe(1);
  });

  it('preserves all field values as strings in the payload', async () => {
    const csv = 'score,flag,name\n85,true,Alice';
    const connector = new CsvFileConnector(async () => csv);
    const result = await connector.pull(makeConfig());

    expect(result.records[0]?.payload).toEqual({
      score: '85',
      flag: 'true',
      name: 'Alice',
    });
  });

  it('sourceRef in returned records matches the configRef-based pattern', async () => {
    const ref = 'bucket://school-01/term1/attendance.csv';
    const connector = new CsvFileConnector(async () => 'a,b\n1,2');
    const result = await connector.pull({
      tenantId: TENANT_ID,
      sourceId: SOURCE_ID,
      configRef: ref,
    });

    expect(result.records[0]?.sourceRef).toBe(`${ref}#row-1`);
  });

  it('kind is FILE_CSV', () => {
    const connector = new CsvFileConnector(async () => '');
    expect(connector.kind).toBe('FILE_CSV');
  });
});

// ---------------------------------------------------------------------------
// Stub connectors — all return empty records
// ---------------------------------------------------------------------------

describe('FileConnector (stub)', () => {
  it('returns empty records for FILE_CSV kind', async () => {
    const c = new FileConnector('FILE_CSV');
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(r.hasMore).toBe(false);
    expect(r.cursor).toBeUndefined();
  });

  it('returns empty records for FILE_XLSX kind', async () => {
    const c = new FileConnector('FILE_XLSX');
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('FILE_XLSX');
  });
});

describe('SisApiConnector (stub)', () => {
  it('returns empty records', async () => {
    const c = new SisApiConnector();
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('SIS_API');
  });
});

describe('ScreenerApiConnector (stub)', () => {
  it('returns empty records', async () => {
    const c = new ScreenerApiConnector();
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('SCREENER_API');
  });
});

describe('AttendanceApiConnector (stub)', () => {
  it('returns empty records', async () => {
    const c = new AttendanceApiConnector();
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('ATTENDANCE_API');
  });
});

describe('BehaviourApiConnector (stub)', () => {
  it('returns empty records', async () => {
    const c = new BehaviourApiConnector();
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('BEHAVIOUR_API');
  });
});

describe('ManualUploadConnector (stub)', () => {
  it('returns empty records', async () => {
    const c = new ManualUploadConnector();
    const r = await c.pull(makeConfig());
    expect(r.records).toHaveLength(0);
    expect(c.kind).toBe('MANUAL_UPLOAD');
  });
});

// ---------------------------------------------------------------------------
// getConnector registry
// ---------------------------------------------------------------------------

describe('getConnector', () => {
  it('returns a stub for FILE_CSV', () => {
    const c = getConnector('FILE_CSV');
    expect(c).toBeDefined();
    expect(c?.kind).toBe('FILE_CSV');
  });

  it('returns a stub for SIS_API', () => {
    const c = getConnector('SIS_API');
    expect(c?.kind).toBe('SIS_API');
  });

  it('returns a stub for SCREENER_API', () => {
    expect(getConnector('SCREENER_API')?.kind).toBe('SCREENER_API');
  });

  it('returns a stub for ATTENDANCE_API', () => {
    expect(getConnector('ATTENDANCE_API')?.kind).toBe('ATTENDANCE_API');
  });

  it('returns a stub for BEHAVIOUR_API', () => {
    expect(getConnector('BEHAVIOUR_API')?.kind).toBe('BEHAVIOUR_API');
  });

  it('returns a stub for MANUAL_UPLOAD', () => {
    expect(getConnector('MANUAL_UPLOAD')?.kind).toBe('MANUAL_UPLOAD');
  });

  it('returns undefined for an unregistered kind in a custom registry', () => {
    const c = getConnector('SIS_API', {});
    expect(c).toBeUndefined();
  });
});
