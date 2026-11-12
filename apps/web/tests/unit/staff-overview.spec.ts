import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The action buttons are client components whose behaviour is their own spec; here each is a stand-in
// that shows the URL it would call, so what the overview *offers* can be asserted.
vi.mock('../../src/components/admin/staff/StaffActionButton', () => ({
  StaffActionButton: (props: { label: string; url: string }) =>
    createElement('button', { 'data-url': props.url, 'data-label': props.label }),
}));
vi.mock('../../src/components/admin/staff/GrantRoleForm', () => ({
  GrantRoleForm: (props: { accountId: string }) =>
    createElement('form', { 'data-grant': props.accountId }),
}));

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

describe('StaffOverview — actions', () => {
  const account = (
    over: Partial<Overview['accounts'][number]> = {},
  ): Overview['accounts'][number] => ({
    id: ADA,
    displayName: 'Ada Abrahams',
    email: 'ada@example.invalid',
    status: 'ACTIVE',
    lastSeenAt: null,
    roles: [{ role: 'hod', expiresAt: null, expired: false }],
    ...over,
  });

  it('offers to give a role to an active account, and to remove each live role it holds', () => {
    const html = render({ ...base, accounts: [account()] });
    expect(html).toContain(`data-grant="${ADA}"`);
    expect(html).toContain(`data-url="/api/admin/staff/accounts/${ADA}/roles/revoke"`);
    expect(html).toContain('data-label="Remove"');
  });

  it.each(['SUSPENDED', 'OFFBOARDED'] as const)(
    'offers nothing to do to a %s account',
    (status) => {
      const html = render({ ...base, accounts: [account({ status })] });
      expect(html).not.toContain('data-grant');
      expect(html).not.toContain('/roles/revoke');
    },
  );

  it('does not offer to remove a role that has already lapsed, or one that is not a staff role', () => {
    const html = render({
      ...base,
      accounts: [
        account({
          roles: [
            { role: 'hod', expiresAt: LAST_YEAR, expired: true },
            { role: 'guardian', expiresAt: null, expired: false },
          ],
        }),
      ],
    });
    expect(html).not.toContain('/roles/revoke');
  });

  it('offers to confirm an invitation only while it awaits a second administrator and has not expired', () => {
    const inv = (
      confirmation: Overview['invitations'][number]['confirmation'],
      expired: boolean,
    ) =>
      render({
        ...base,
        invitations: [
          {
            id: 'i1',
            email: 'n@example.invalid',
            roles: ['admin'],
            confirmation,
            expiresAt: NEXT_YEAR,
            expired,
          },
        ],
      });
    expect(inv('AWAITING', false)).toContain('/invitations/i1/confirm');
    expect(inv('AWAITING', true)).not.toContain('/invitations/i1/confirm');
    expect(inv('NOT_REQUIRED', false)).not.toContain('/invitations/i1/confirm');
    expect(inv('CONFIRMED', false)).not.toContain('/invitations/i1/confirm');
    // Revoking is always on offer for a pending invitation.
    expect(inv('AWAITING', true)).toContain('/invitations/i1/revoke');
  });

  it('offers to confirm, decline or cancel a waiting request — and only to cancel one that has expired', () => {
    const req = (expired: boolean) =>
      render({
        ...base,
        accounts: [account()],
        grantRequests: [
          {
            id: 'g1',
            targetAccountId: ADA,
            roles: ['admin'],
            requestedBy: ZOE,
            expiresAt: NEXT_YEAR,
            expired,
          },
        ],
      });
    const live = req(false);
    for (const action of ['confirm', 'decline', 'cancel']) {
      expect(live).toContain(`/role-requests/g1/${action}`);
    }
    const lapsed = req(true);
    expect(lapsed).toContain('/role-requests/g1/cancel');
    expect(lapsed).not.toContain('/role-requests/g1/confirm');
    expect(lapsed).not.toContain('/role-requests/g1/decline');
  });
});

describe('StaffOverview — account status actions', () => {
  const acc = (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED') => ({
    id,
    displayName: id === ADA ? 'Ada Abrahams' : 'Zoe Zulu',
    email: `${id}@example.invalid`,
    status,
    lastSeenAt: null,
    roles: [],
  });
  const html = (accounts: Overview['accounts'], selfId?: string): string =>
    renderToStaticMarkup(
      createElement(StaffOverview, {
        overview: { ...base, accounts },
        ...(selfId === undefined ? {} : { selfId }),
      }),
    );
  const labels = (markup: string): string[] =>
    [...markup.matchAll(/data-label="([^"]+)"/g)].map((m) => m[1] ?? '');

  it('offers an active account both Suspend and Offboard', () => {
    const l = labels(html([acc(ADA, 'ACTIVE')]));
    expect(l).toContain('Suspend');
    expect(l).toContain('Offboard');
  });

  it('offers a suspended account only Offboard', () => {
    const l = labels(html([acc(ADA, 'SUSPENDED')]));
    expect(l).not.toContain('Suspend');
    expect(l).toContain('Offboard');
  });

  it('offers an offboarded account nothing — it is final', () => {
    const l = labels(html([acc(ADA, 'OFFBOARDED')]));
    expect(l).not.toContain('Suspend');
    expect(l).not.toContain('Offboard');
  });

  it('offers nothing on the viewer’s own account, and still does on everyone else’s', () => {
    const markup = html([acc(ADA, 'ACTIVE'), acc(ZOE, 'ACTIVE')], ADA);
    expect(markup).not.toContain(`/accounts/${ADA}/status`);
    expect(markup).toContain(`/accounts/${ZOE}/status`);
  });
});
