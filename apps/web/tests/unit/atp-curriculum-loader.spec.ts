import { describe, it, expect, vi, beforeEach } from 'vitest';

// Rule 5: the only way this module reaches the database is `withTenant`, with exactly the
// tenant and actor it was given.
const { withTenant, listEffectiveConstitution } = vi.hoisted(() => ({
  withTenant: vi.fn(),
  listEffectiveConstitution: vi.fn(),
}));

vi.mock('@infinite-ai/db', () => ({ withTenant, listEffectiveConstitution }));

import { loadCurriculumMap } from '../../src/lib/atp-curriculum-loader.js';

const SCOPE = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  actorId: '5b1a0000-0000-4000-8000-0000000000aa',
};
const TX = { tx: true };

describe('loadCurriculumMap', () => {
  beforeEach(() => {
    withTenant.mockReset();
    listEffectiveConstitution.mockReset();
    withTenant.mockImplementation((_ctx: unknown, fn: (tx: unknown) => unknown) =>
      fn(TX),
    );
  });

  it('reads inside withTenant with exactly the scope it was given, then builds the map', async () => {
    listEffectiveConstitution.mockResolvedValue([
      {
        kind: 'ATP_CALENDAR',
        content: {
          grade: '6',
          subject: 'Mathematics',
          atpYear: 2023,
          documentId: 'G6-MATHS-2023',
          sourceDescription: 'Grade 6 Mathematics — DBE 2023',
          topics: [
            { term: 1, topic: 'Numbers', weekStart: 1, weekEnd: 2, contentArea: 'N' },
          ],
        },
      },
      { kind: 'CAPS_CANON', content: { not: 'atp' } },
    ]);

    const data = await loadCurriculumMap(SCOPE, '6', 'Mathematics');

    expect(withTenant).toHaveBeenCalledTimes(1);
    expect(withTenant.mock.calls[0]?.[0]).toEqual(SCOPE);
    expect(listEffectiveConstitution).toHaveBeenCalledWith(TX);
    expect(data.selection).toEqual({ grade: '6', subject: 'Mathematics' });
    expect(data.groups[0]?.topics).toHaveLength(1);
  });

  it('yields the empty state when the tenant has no ATP rows', async () => {
    listEffectiveConstitution.mockResolvedValue([]);

    const data = await loadCurriculumMap(SCOPE, undefined, undefined);

    expect(data.selection).toBeNull();
  });

  it('lets a database failure surface instead of showing an empty curriculum as if it were real', async () => {
    withTenant.mockRejectedValue(new Error('connection refused'));

    await expect(loadCurriculumMap(SCOPE, undefined, undefined)).rejects.toThrow(
      'connection refused',
    );
  });
});
