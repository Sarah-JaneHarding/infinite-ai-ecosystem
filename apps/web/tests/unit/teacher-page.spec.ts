import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

import type { CurriculumMapData } from '../../src/lib/atp-curriculum.js';

// Security test: the Teacher Studio reads tenant data. The tenant and actor must come from
// the verified session — never from the URL — and the read must not happen at all for an
// unauthenticated caller, a non-teacher, or a session with no tenant context (rule 5).
const { getServerSession, redirect, loadCurriculumMap } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
  loadCurriculumMap: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/atp-curriculum-loader', () => ({ loadCurriculumMap }));
vi.mock('@/components/teacher/TeacherStudio', () => ({ TeacherStudio: () => null }));

import TeacherPage from '../../src/app/(shell)/teacher/page.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const USER = '5b1a0000-0000-4000-8000-0000000000aa';

const LOADED: CurriculumMapData = {
  catalogue: { grades: ['6'], subjectsByGrade: { '6': ['Mathematics'] } },
  selection: { grade: '6', subject: 'Mathematics' },
  groups: [],
  skipped: 0,
};

const teacherSession = { role: 'teacher', tenantId: TENANT, userId: USER };

async function render(
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<ReactElement<{ curriculum: CurriculumMapData }>> {
  return (await TeacherPage({
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{ curriculum: CurriculumMapData }>;
}

describe('Teacher page — tenant-scoped curriculum read', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    loadCurriculumMap.mockReset();
    loadCurriculumMap.mockResolvedValue(LOADED);
  });

  it('reads the curriculum for the session tenant and actor and hands it to the studio', async () => {
    getServerSession.mockResolvedValue(teacherSession);

    const element = await render({ grade: '6', subject: 'Mathematics' });

    expect(loadCurriculumMap).toHaveBeenCalledTimes(1);
    expect(loadCurriculumMap).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      '6',
      'Mathematics',
    );
    expect(element.props.curriculum).toBe(LOADED);
  });

  it('never takes the tenant or actor from the query string', async () => {
    getServerSession.mockResolvedValue(teacherSession);

    await render({
      tenantId: '20000000-0000-4000-8000-000000000002',
      actorId: '00000000-0000-4000-8000-00000000dead',
      tenant_id: '20000000-0000-4000-8000-000000000002',
    });

    expect(loadCurriculumMap).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      undefined,
      undefined,
    );
  });

  it('ignores a repeated query parameter instead of picking one of the values', async () => {
    getServerSession.mockResolvedValue(teacherSession);

    await render({ grade: ['6', '7'], subject: undefined });

    expect(loadCurriculumMap).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: USER },
      undefined,
      undefined,
    );
  });

  it('sends an unauthenticated caller to sign-in without touching the database', async () => {
    getServerSession.mockResolvedValue(null);

    await expect(render()).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadCurriculumMap).not.toHaveBeenCalled();
  });

  it.each(['hod', 'smt', 'sbst', 'admin', 'guardian', 'learner', 'platform_admin'])(
    'refuses the %s role without touching the database',
    async (role) => {
      getServerSession.mockResolvedValue({ ...teacherSession, role });

      await expect(render()).rejects.toThrow('REDIRECT:/');
      expect(loadCurriculumMap).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no tenant', { tenantId: '' }],
    ['no user id', { userId: '' }],
  ])(
    'shows the empty state and makes no database read for a session with %s',
    async (_label, override) => {
      getServerSession.mockResolvedValue({ ...teacherSession, ...override });

      const element = await render();

      expect(loadCurriculumMap).not.toHaveBeenCalled();
      expect(element.props.curriculum.selection).toBeNull();
      expect(element.props.curriculum.groups).toEqual([]);
    },
  );
});
