import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement, type ReactNode } from 'react';

import { SmdDashboard } from '../../src/components/smt/SmdDashboard.js';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement('a', { href }, children),
}));

const html = (pendingApprovals: number | null): string =>
  renderToStaticMarkup(SmdDashboard({ pendingApprovals }) as ReactElement);

// The dashboard used to show invented figures. None of them may come back.
const INVENTED = [
  '412',
  '71',
  '18',
  '82%',
  '14%',
  '4%',
  'Operational',
  'No active incidents',
  'All modules running',
  '3 teachers',
  'CPTD artefacts',
  'Tier 1',
  'Tier 2',
  'Tier 3',
];

describe('SMT dashboard', () => {
  it.each([0, 1, 5, null])('contains no invented figure (pending = %s)', (pending) => {
    const out = html(pending);
    for (const text of INVENTED) expect(out).not.toContain(text);
  });

  it('shows the real count, singular and plural', () => {
    expect(html(1)).toContain('1 item is waiting');
    expect(html(5)).toContain('5 items are waiting');
  });

  it('says nothing is waiting for zero, rather than a bare number', () => {
    expect(html(0)).toContain('Nothing is waiting for you.');
  });

  it('shows the count as unavailable — not zero — when it could not be read', () => {
    const out = html(null);
    expect(out).toContain('unavailable');
    expect(out).not.toContain('Nothing is waiting');
  });

  it('links to the approvals queue', () => {
    expect(html(2)).toContain('href="/approvals"');
  });

  it('says plainly that tiers and PD are not available instead of showing numbers', () => {
    const out = html(2);
    expect(out).toContain('Support tiers are not set up for your school');
    expect(out).toContain('not connected yet');
    expect(out.match(/Not available yet/g)).toHaveLength(2);
  });
});
