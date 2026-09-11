import { describe, expect, it } from 'vitest';

import { parseCsv } from '../../src/ingest/csv-parser.js';

describe('parseCsv', () => {
  it('returns empty array for empty string', () => {
    expect(parseCsv('', 'file.csv')).toEqual([]);
  });

  it('returns empty array for header-only content', () => {
    expect(parseCsv('id,name,score\n', 'file.csv')).toEqual([]);
  });

  it('parses a basic three-column CSV', () => {
    const rows = parseCsv('id,name,score\n1,Alice,85\n2,Bob,72', 'school.csv');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      rowIndex: 1,
      sourceRef: 'school.csv#row-1',
      fields: { id: '1', name: 'Alice', score: '85' },
    });
    expect(rows[1]).toMatchObject({
      rowIndex: 2,
      sourceRef: 'school.csv#row-2',
      fields: { id: '2', name: 'Bob', score: '72' },
    });
  });

  it('embeds fileRef in every sourceRef for idempotency', () => {
    const rows = parseCsv('id\n1\n2', 'uploads/attendance-2026-t1.csv');
    expect(rows[0]?.sourceRef).toBe('uploads/attendance-2026-t1.csv#row-1');
    expect(rows[1]?.sourceRef).toBe('uploads/attendance-2026-t1.csv#row-2');
  });

  it('sourceRef stays stable across repeated parses of the same content', () => {
    const content = 'a,b\n1,2\n3,4';
    const first = parseCsv(content, 'stable.csv');
    const second = parseCsv(content, 'stable.csv');
    expect(first[0]?.sourceRef).toBe(second[0]?.sourceRef);
    expect(first[1]?.sourceRef).toBe(second[1]?.sourceRef);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('id,name\r\n1,Alice\r\n2,Bob\r\n', 'crlf.csv');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.fields).toEqual({ id: '1', name: 'Alice' });
    expect(rows[1]?.fields).toEqual({ id: '2', name: 'Bob' });
  });

  it('handles CR-only line endings', () => {
    const rows = parseCsv('id,name\r1,Alice\r2,Bob', 'cr.csv');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.fields).toEqual({ id: '1', name: 'Alice' });
  });

  it('strips trailing blank lines', () => {
    const rows = parseCsv('id\n1\n2\n\n', 'trailing.csv');
    expect(rows).toHaveLength(2);
  });

  it('handles quoted fields that contain commas', () => {
    const rows = parseCsv('name,address\n"Smith, John","12 Main St"', 'quoted.csv');
    expect(rows[0]?.fields).toEqual({
      name: 'Smith, John',
      address: '12 Main St',
    });
  });

  it('handles escaped double-quotes inside quoted fields', () => {
    const rows = parseCsv('note\n"He said ""hello"""\n', 'escaped.csv');
    expect(rows[0]?.fields).toEqual({ note: 'He said "hello"' });
  });

  it('handles empty fields (consecutive commas)', () => {
    const rows = parseCsv('a,b,c\n1,,3', 'empty-fields.csv');
    expect(rows[0]?.fields).toEqual({ a: '1', b: '', c: '3' });
  });

  it('rowIndex is 1-based and sequential', () => {
    const rows = parseCsv('x\na\nb\nc', 'idx.csv');
    expect(rows.map((r) => r.rowIndex)).toEqual([1, 2, 3]);
  });

  it('missing values at end of row default to empty string', () => {
    const rows = parseCsv('a,b,c\n1,2', 'short.csv');
    expect(rows[0]?.fields).toEqual({ a: '1', b: '2', c: '' });
  });
});
