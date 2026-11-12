import { createElement } from 'react';
import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ROLE_LABEL } from '../../src/lib/roles.js';
import { InviteFormView } from '../../src/components/admin/staff/InviteForm.js';
import { GrantRoleFormView } from '../../src/components/admin/staff/GrantRoleForm.js';
import { ActionButtonView } from '../../src/components/admin/staff/StaffActionButton.js';

const noop = (): void => {};
const view = (over: Partial<Parameters<typeof InviteFormView>[0]> = {}): string =>
  renderToStaticMarkup(
    createElement(InviteFormView, {
      email: '',
      roles: [],
      schools: [],
      schoolId: '',
      busy: false,
      notice: null,
      onEmail: noop,
      onToggleRole: noop,
      onSchool: noop,
      onSubmit: noop,
      ...over,
    }),
  );

describe('InviteFormView', () => {
  it('offers every school staff role, named for a person, and no platform role', () => {
    const html = view();
    for (const role of SCHOOL_STAFF_ROLES) expect(html).toContain(ROLE_LABEL[role]);
    expect(html).not.toContain('Platform');
    expect(html).not.toContain('Guardian');
    expect(html.match(/type="checkbox"/g)).toHaveLength(SCHOOL_STAFF_ROLES.length);
  });

  it('cannot be submitted with no role chosen, or while sending', () => {
    expect(view()).toContain('disabled=""');
    expect(view({ roles: ['teacher'] })).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(view()).toMatch(/<button[^>]*\sdisabled=""/);
    expect(view({ roles: ['teacher'], busy: true })).toContain('Sending…');
  });

  it('shows what was last said, an error as an alert and a success as a status', () => {
    expect(view({ notice: { kind: 'error', text: 'Nope.' } })).toContain('role="alert"');
    const ok = view({ notice: { kind: 'ok', text: 'Done.' } });
    expect(ok).toContain('role="status"');
    expect(ok).toContain('Done.');
  });

  it('escapes the address a person typed', () => {
    const html = view({ email: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>');
  });
});

describe('ActionButtonView', () => {
  const render = (over: Partial<Parameters<typeof ActionButtonView>[0]> = {}): string =>
    renderToStaticMarkup(
      createElement(ActionButtonView, {
        label: 'Revoke',
        busyLabel: 'Revoking…',
        busy: false,
        error: null,
        onClick: noop,
        ...over,
      }),
    );

  it('shows its label, its busy label while working, and the reason when it failed', () => {
    const idle = render();
    expect(idle).toContain('Revoke');
    expect(idle).not.toContain('role="alert"');
    expect(render({ busy: true })).toContain('Revoking…');
    expect(render({ error: 'Already gone.' })).toContain('Already gone.');
  });

  it('is disabled while working, and marks a refusing act as dangerous', () => {
    expect(render({ busy: true })).toMatch(/<button[^>]*\sdisabled=""/);
    expect(render()).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(render({ tone: 'danger' })).toContain('iai-error-text');
    expect(render()).not.toContain('iai-error-text');
  });
});

describe('GrantRoleFormView', () => {
  const render = (over: Partial<Parameters<typeof GrantRoleFormView>[0]> = {}): string =>
    renderToStaticMarkup(
      createElement(GrantRoleFormView, {
        role: '',
        schools: [],
        schoolId: '',
        busy: false,
        notice: null,
        onRole: noop,
        onSchool: noop,
        onSubmit: noop,
        ...over,
      }),
    );

  it('offers every school staff role, named for a person, and no platform role', () => {
    const html = render();
    for (const role of SCHOOL_STAFF_ROLES) expect(html).toContain(ROLE_LABEL[role]);
    expect(html).not.toContain('Platform');
    expect(html.match(/<option/g)).toHaveLength(SCHOOL_STAFF_ROLES.length + 1);
  });

  it('cannot be submitted until a role is chosen, or while working', () => {
    expect(render()).toMatch(/<button[^>]*\sdisabled=""/);
    expect(render({ role: 'hod' })).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(render({ role: 'hod', busy: true })).toContain('Giving…');
  });

  it('shows what was last said', () => {
    expect(render({ notice: { kind: 'error', text: 'Nope.' } })).toContain(
      'role="alert"',
    );
    expect(render({ notice: { kind: 'ok', text: 'Done.' } })).toContain('role="status"');
  });
});

describe('the school pickers', () => {
  const SCHOOLS = [
    { id: 's1', name: 'Alpha Primary' },
    { id: 's2', name: 'Zulu Primary' },
  ];

  it('are absent for a tenant with no school or one school — there is nothing to choose between', () => {
    for (const schools of [[], [SCHOOLS[0]!]]) {
      const invite = renderToStaticMarkup(
        createElement(InviteFormView, {
          email: '',
          roles: [],
          schools,
          schoolId: '',
          busy: false,
          notice: null,
          onEmail: noop,
          onToggleRole: noop,
          onSchool: noop,
          onSubmit: noop,
        }),
      );
      expect(invite).not.toContain('Whole school group');
      const grant = renderToStaticMarkup(
        createElement(GrantRoleFormView, {
          role: '',
          schools,
          schoolId: '',
          busy: false,
          notice: null,
          onRole: noop,
          onSchool: noop,
          onSubmit: noop,
        }),
      );
      expect(grant).not.toContain('Whole school group');
    }
  });

  it('list each school by name, with the whole group as the default, on both forms', () => {
    const invite = renderToStaticMarkup(
      createElement(InviteFormView, {
        email: '',
        roles: [],
        schools: SCHOOLS,
        schoolId: '',
        busy: false,
        notice: null,
        onEmail: noop,
        onToggleRole: noop,
        onSchool: noop,
        onSubmit: noop,
      }),
    );
    const grant = renderToStaticMarkup(
      createElement(GrantRoleFormView, {
        role: '',
        schools: SCHOOLS,
        schoolId: 's2',
        busy: false,
        notice: null,
        onRole: noop,
        onSchool: noop,
        onSubmit: noop,
      }),
    );
    for (const html of [invite, grant]) {
      expect(html).toContain('Whole school group');
      expect(html).toContain('Alpha Primary');
      expect(html).toContain('Zulu Primary');
    }
    expect(grant).toMatch(/<option value="s2" selected="">Zulu Primary<\/option>/);
  });
});
