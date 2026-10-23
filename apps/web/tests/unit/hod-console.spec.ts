import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement, type ReactNode } from 'react';

import { HodConsole } from '../../src/components/hod/HodConsole.js';
import type { PendingApproval } from '../../src/lib/approvals.js';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}));

const item = (n: number): PendingApproval => ({
  id: `3a000000-0000-4000-8000-00000000000${n}`,
  runId: `7e1a0000-0000-4000-8000-00000000000${n}`,
  stepId: `gate-${n}`,
  requiredRole: 'hod',
  openedAt: `2026-10-0${n}T08:30:00.000Z`,
});

const html = (pending: readonly PendingApproval[] | null): string =>
  renderToStaticMarkup(HodConsole({ pending }) as ReactElement);

// The console used to show invented rows. None of them may come back.
const INVENTED = [
  'Ms Nkosi',
  'Mr Dlamini',
  'Physics',
  'Life Sci',
  'Gr 8',
  'Gr 11',
  'Mathematics',
  '72%',
  '58%',
  '83%',
  'Lesson plan',
  'progressbar',
];

describe('HoD console', () => {
  it.each([[[]], [[item(1)]], [[item(1), item(2), item(3)]], [null]])(
    'contains no invented row or percentage (%j)',
    (pending) => {
      const out = html(pending as PendingApproval[] | null);
      for (const text of INVENTED) expect(out).not.toContain(text);
    },
  );

  it('lists the real tasks, each linking to its own review page with its run id', () => {
    const out = html([item(1), item(2)]);
    expect(out).toContain('gate-1');
    expect(out).toContain('Opened 2026-10-01 08:30 UTC');
    expect(out).toContain(
      'href="/approvals/3a000000-0000-4000-8000-000000000001?runId=7e1a0000-0000-4000-8000-000000000001"',
    );
    expect(out).toContain(
      'href="/approvals/3a000000-0000-4000-8000-000000000002?runId=7e1a0000-0000-4000-8000-000000000002"',
    );
    expect(out).toContain('2 items');
  });

  it('says "1 item", not "1 items"', () => {
    expect(html([item(1)])).toContain('1 item<');
  });

  it('shows at most five, and says how many more, with a link to all of them', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map(item);
    const out = html(many);
    expect(out).toContain('gate-5');
    expect(out).not.toContain('gate-6');
    expect(out).toContain('and 2 more.');
    expect(out).toContain('href="/approvals"');
    expect(out).toContain('7 items');
  });

  it('does not say "more" when everything fits', () => {
    expect(html([1, 2, 3, 4, 5].map(item))).not.toContain('more.');
  });

  it('says nothing is waiting for an empty list', () => {
    expect(html([])).toContain('Nothing is waiting for your decision.');
  });

  it('shows the list as unavailable — not empty — when it could not be read', () => {
    const out = html(null);
    expect(out).toContain('unavailable');
    expect(out).not.toContain('Nothing is waiting');
  });

  it('says plainly that coverage is not tracked, with no figure', () => {
    const out = html([]);
    expect(out).toContain('Curriculum coverage is not tracked yet');
    expect(out).toContain('Not available yet');
  });
});
