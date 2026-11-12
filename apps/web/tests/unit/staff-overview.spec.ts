import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { StaffOverview as Overview } from '@infinite-ai/db';

import { StaffOverview } from '../../src/components/admin/staff/StaffOverview.js';

const ADA = 'acc00000-0000-4000-8000-000000000001';
const ZOE = 'acc00000-0000-4000-8000-000000000002';
const NEXT_YEAR = new Date('2027-03-01T00:00:00.000Z');
const LAST_YEAR = new Date('2025-03-01T00:00:00.000Z');

const base: Overview = {
  accounts: [],
  invitations: [],
  grantRequests: [],
  truncated: false,
};
const render = (overview: Overview): string =>
  renderToStaticMarkup(createElement(StaffOverview, { overview }));

describe('StaffOverview', () => {
  it('says so, kindly, when there is nothing yet', () => {
    const html = render(base);
    expect(html).toContain('No one has signed in yet');
    expect(html).toContain('No invitations are waiting');
    expect(html).toContain('No role requests are waiting');
    expect(html).not.toContain('<table');
  });

  it('shows each account with its status and roles, naming roles for a person', () => {
    const html = render({
      ...base,
      accounts: [
        {
          id: ADA,
          displayName: 'Ada Abrahams',
          email: 'ada@example.invalid',
          status: 'SUSPENDED',
          lastSeenAt: null,
          roles: [
            { role: 'admin', expiresAt: null, expired: false },
            { role: 'hod', expiresAt: NEXT_YEAR, expired: false },
            { role: 'sbst', expiresAt: LAST_YEAR, expired: true },
          ],
        },
      ],
    });
    expect(html).toContain('Ada Abrahams');
    expect(html).toContain('ada@example.invalid');
    expect(html).toContain('Suspended');
    expect(html).toContain('Administrator');
    expect(html).toContain('Head of Department (until 2027-03-01)');
    expect(html).toContain('School-Based Support Team (lapsed)');
  });

  it('says "None" for an account with no roles, and shows an unknown stored role as stored', () => {
    const html = render({
      ...base,
      accounts: [
        {
          id: ZOE,
          displayName: 'Zoe Zulu',
          email: 'zoe@example.invalid',
          status: 'ACTIVE',
          lastSeenAt: null,
          roles: [],
        },
        {
          id: ADA,
          displayName: 'Ada Abrahams',
          email: 'ada@example.invalid',
          status: 'ACTIVE',
          lastSeenAt: null,
          roles: [{ role: 'retired_role', expiresAt: null, expired: false }],
        },
      ],
    });
    expect(html).toContain('None');
    expect(html).toContain('retired_role');
  });

  it('shows pending invitations with whether they are expired and what they wait for', () => {
    const html = render({
      ...base,
      invitations: [
        {
          id: 'i1',
          email: 'new@example.invalid',
          roles: ['hod', 'teacher'],
          confirmation: 'AWAITING',
          expiresAt: NEXT_YEAR,
          expired: false,
        },
        {
          id: 'i2',
          email: 'old@example.invalid',
          roles: ['teacher'],
          confirmation: 'NOT_REQUIRED',
          expiresAt: LAST_YEAR,
          expired: true,
        },
      ],
    });
    expect(html).toContain('new@example.invalid');
    expect(html).toContain('Head of Department, Teacher');
    expect(html).toContain('Waiting for a second administrator');
    expect(html).toContain('2025-03-01 (expired)');
  });

  it('names the people in a role request, and never shows an id for one it cannot find', () => {
    const html = render({
      ...base,
      accounts: [
        {
          id: ADA,
          displayName: 'Ada Abrahams',
          email: 'ada@example.invalid',
          status: 'ACTIVE',
          lastSeenAt: null,
          roles: [],
        },
      ],
      grantRequests: [
        {
          id: 'g1',
          targetAccountId: ADA,
          roles: ['admin', 'smt'],
          requestedBy: ZOE,
          expiresAt: NEXT_YEAR,
          expired: false,
        },
      ],
    });
    expect(html).toContain('Administrator, School Management Team');
    expect(html).toContain('Unknown account');
    expect(html).not.toContain(ZOE);
  });

  it('warns when the list was cut short', () => {
    expect(render({ ...base, truncated: true })).toContain('cut short');
    expect(render(base)).not.toContain('cut short');
  });

  it('escapes what a person typed rather than rendering it', () => {
    const html = render({
      ...base,
      accounts: [
        {
          id: ADA,
          displayName: '<script>alert(1)</script>',
          email: 'a@example.invalid',
          status: 'ACTIVE',
          lastSeenAt: null,
          roles: [],
        },
      ],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
