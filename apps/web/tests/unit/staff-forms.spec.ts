import { createElement } from 'react';
import { SCHOOL_STAFF_ROLES } from '@infinite-ai/policy';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ROLE_LABEL } from '../../src/lib/roles.js';
import { InviteFormView } from '../../src/components/admin/staff/InviteForm.js';
import { RevokeButtonView } from '../../src/components/admin/staff/RevokeInvitationButton.js';

const noop = (): void => {};
const view = (over: Partial<Parameters<typeof InviteFormView>[0]> = {}): string =>
  renderToStaticMarkup(
    createElement(InviteFormView, {
      email: '',
      roles: [],
      busy: false,
      notice: null,
      onEmail: noop,
      onToggleRole: noop,
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

describe('RevokeButtonView', () => {
  it('shows a button, a busy state, and the reason when it failed', () => {
    const idle = renderToStaticMarkup(
      createElement(RevokeButtonView, { busy: false, error: null, onClick: noop }),
    );
    expect(idle).toContain('Revoke');
    expect(idle).not.toContain('role="alert"');
    expect(
      renderToStaticMarkup(
        createElement(RevokeButtonView, { busy: true, error: null, onClick: noop }),
      ),
    ).toContain('Revoking…');
    expect(
      renderToStaticMarkup(
        createElement(RevokeButtonView, {
          busy: false,
          error: 'Already gone.',
          onClick: noop,
        }),
      ),
    ).toContain('Already gone.');
  });
});
