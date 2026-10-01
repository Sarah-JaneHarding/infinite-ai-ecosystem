import { describe, it, expect } from 'vitest';
import type { ApprovalTaskRow } from '@infinite-ai/db';

import {
  approvalHref,
  describeValue,
  formatOpened,
  queueFor,
  toPending,
  viewFor,
} from '../../src/lib/approvals.js';

const RUN = '7e1a0000-0000-4000-8000-000000000001';

function row(over: Partial<ApprovalTaskRow> = {}): ApprovalTaskRow {
  return {
    id: '3a000000-0000-4000-8000-000000000001',
    tenantId: '10000000-0000-4000-8000-000000000001',
    runId: RUN,
    stepId: 'gate',
    requiredRole: 'hod',
    artefact: { draft: 'v1' },
    diffAgainstPrevious: null,
    evidence: { source: 'CE-01' },
    traceId: 'trace',
    decision: null,
    decidedBy: null,
    decidedAt: null,
    reason: null,
    editDiff: null,
    createdAt: new Date('2026-10-01T08:30:00.000Z'),
    updatedAt: new Date('2026-10-01T08:30:00.000Z'),
    ...over,
  };
}

describe('queueFor', () => {
  it('keeps undecided tasks waiting on the role, in the order given', () => {
    const a = row({ id: 'a' });
    const b = row({ id: 'b' });
    expect(queueFor([a, b], 'hod').map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('drops decided tasks and tasks waiting on another role', () => {
    const rows = [
      row({ id: 'mine' }),
      row({ id: 'decided', decision: 'APPROVED' }),
      row({ id: 'smt-task', requiredRole: 'smt' }),
    ];
    expect(queueFor(rows, 'hod').map((i) => i.id)).toEqual(['mine']);
    expect(queueFor(rows, 'teacher')).toEqual([]);
  });

  it('exposes no artefact content in the list', () => {
    expect(Object.keys(toPending(row())).sort()).toEqual([
      'id',
      'openedAt',
      'requiredRole',
      'runId',
      'stepId',
    ]);
    expect(toPending(row()).openedAt).toBe('2026-10-01T08:30:00.000Z');
  });
});

describe('viewFor', () => {
  it('returns the stored artefact, evidence and diff for the right role and run', () => {
    const view = viewFor(row({ diffAgainstPrevious: { added: ['x'] } }), 'hod', RUN);
    expect(view?.artefact).toEqual({ draft: 'v1' });
    expect(view?.evidence).toEqual({ source: 'CE-01' });
    expect(view?.diffAgainstPrevious).toEqual({ added: ['x'] });
  });

  it('is null for a missing task', () => {
    expect(viewFor(null, 'hod', RUN)).toBeNull();
  });

  it('is null for a task already decided — a decision is recorded once', () => {
    expect(viewFor(row({ decision: 'REJECTED' }), 'hod', RUN)).toBeNull();
  });

  it('is null for a task waiting on a different role', () => {
    expect(viewFor(row(), 'teacher', RUN)).toBeNull();
  });

  it('is null when the run id does not belong to the task', () => {
    expect(viewFor(row(), 'hod', '7e1a0000-0000-4000-8000-0000000000ff')).toBeNull();
  });
});

describe('approvalHref', () => {
  it('carries the run id the decide route needs, encoded', () => {
    expect(approvalHref({ id: 'a b', runId: 'r&1' })).toBe(
      '/approvals/a%20b?runId=r%261',
    );
  });
});

describe('describeValue', () => {
  it('shows a string as written and anything else as indented JSON', () => {
    expect(describeValue('plain text')).toBe('plain text');
    expect(describeValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(describeValue(null)).toBe('null');
  });

  it('shows nothing, not "undefined", for a value JSON cannot represent', () => {
    expect(describeValue(undefined)).toBe('');
  });
});

describe('formatOpened', () => {
  it('is a fixed UTC format, whatever the viewer time zone', () => {
    expect(formatOpened('2026-10-01T08:30:59.999Z')).toBe('2026-10-01 08:30 UTC');
    expect(formatOpened('2026-12-31T23:59:00.000Z')).toBe('2026-12-31 23:59 UTC');
  });
});
