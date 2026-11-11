import { describe, expect, it } from 'vitest';

import { identityFromProfile } from '../../src/lib/profile-claims';

describe('identityFromProfile', () => {
  it('reads the address, its verification and the name', () => {
    expect(
      identityFromProfile({ email: 'a@b.invalid', email_verified: true, name: 'Ada L' }),
    ).toEqual({ email: 'a@b.invalid', emailVerified: true, displayName: 'Ada L' });
  });

  it('falls back to the username when there is no name', () => {
    expect(identityFromProfile({ preferred_username: 'ada' }).displayName).toBe('ada');
  });

  it.each([['true'], ['TRUE'], [1], [null], [undefined], [{}]])(
    'counts email_verified %j as NOT verified — only the boolean true is',
    (value) => {
      expect(
        identityFromProfile({ email: 'a@b.invalid', email_verified: value })
          .emailVerified,
      ).toBe(false);
    },
  );

  it.each([[undefined], [null], ['text'], [42], [[]]])(
    'reads nothing from a profile that is %j',
    (profile) => {
      expect(identityFromProfile(profile)).toEqual({
        email: '',
        emailVerified: false,
        displayName: '',
      });
    },
  );

  it('ignores a claim of the wrong type', () => {
    expect(identityFromProfile({ email: 7, name: false })).toMatchObject({
      email: '',
      displayName: '',
    });
  });
});
