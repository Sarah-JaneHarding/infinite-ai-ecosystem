import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { accountNotice, noRoleNotice } from '../../src/lib/account-notice';
import { SIGN_IN_OUTCOMES } from '../../src/lib/sign-in-outcome';
import { AccountNotice } from '../../src/components/shell/AccountNotice';

const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const SCHOOL_ROLES = ['teacher', 'hod', 'smt', 'sbst', 'sbst_chair', 'admin'];

describe('accountNotice', () => {
  it.each(SIGN_IN_OUTCOMES.map((o) => [o]))(
    'says something for a school role with no account whose outcome is %s',
    (outcome) => {
      const message = accountNotice('teacher', '', outcome);
      expect(message).toEqual(expect.any(String));
      expect(message).not.toBe('');
    },
  );

  it('tells a person with no invitation to ask the administrator, in plain words', () => {
    expect(accountNotice('hod', '', 'no_invitation')).toMatch(
      /administrator to invite you/,
    );
  });

  it('gives a person whose token predates outcomes the generic message, not nothing', () => {
    expect(accountNotice('teacher', '', null)).toMatch(/don't have an account/);
  });

  it.each(SCHOOL_ROLES.map((r) => [r]))(
    'says nothing once a %s has an account',
    (role) => {
      expect(accountNotice(role, ACCOUNT, 'existing')).toBeNull();
      expect(accountNotice(role, ACCOUNT, 'linked')).toBeNull();
    },
  );

  it.each([['platform_admin'], ['platform_support'], ['guardian'], ['learner']])(
    'says nothing to %s, who has no school account by design',
    (role) => {
      expect(accountNotice(role, '', 'no_invitation')).toBeNull();
      expect(accountNotice(role, '', null)).toBeNull();
    },
  );

  it('never contains an email address', () => {
    for (const outcome of SIGN_IN_OUTCOMES) {
      expect(accountNotice('teacher', '', outcome) ?? '').not.toMatch(/\S+@\S+/);
    }
  });
});

describe('noRoleNotice', () => {
  it('without an account, gives that outcome’s own explanation', () => {
    expect(noRoleNotice('', 'no_invitation')).toBe(
      accountNotice('teacher', '', 'no_invitation'),
    );
    expect(noRoleNotice('', 'invitation_expired')).toContain('expired');
  });

  it('without an account or a known outcome, still says something', () => {
    expect(noRoleNotice('', null)).toContain("don't have an account");
  });

  it('with an account, says the roles do not match — and what to do', () => {
    const text = noRoleNotice(ACCOUNT, 'existing');
    expect(text).toContain('no role');
    expect(text).toContain("Ask your school's administrator");
  });

  it('never contains an email address', () => {
    for (const outcome of SIGN_IN_OUTCOMES) {
      expect(noRoleNotice('', outcome)).not.toMatch(/\S+@\S+/);
      expect(noRoleNotice(ACCOUNT, outcome)).not.toMatch(/\S+@\S+/);
    }
  });
});

describe('AccountNotice', () => {
  it('renders the message as a status', () => {
    const html = renderToStaticMarkup(
      createElement(AccountNotice, { message: 'Hello there' }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Hello there');
  });

  it('renders nothing without a message', () => {
    expect(renderToStaticMarkup(createElement(AccountNotice, { message: null }))).toBe(
      '',
    );
  });
});
