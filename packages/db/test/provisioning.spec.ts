import { describe, expect, it } from 'vitest';

import { defaultInvitationExpiry, normaliseEmail } from '../src/provisioning.js';

describe('normaliseEmail', () => {
  it('trims and lower-cases, and nothing else', () => {
    expect(normaliseEmail('  Ada.Lovelace+tag@Example.INVALID ')).toBe(
      'ada.lovelace+tag@example.invalid',
    );
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['no @', 'ada.example.invalid'],
    ['@ first', '@example.invalid'],
    ['inner whitespace', 'ada lovelace@example.invalid'],
    ['a control character', 'ada\u0007@example.invalid'],
    ['over 254 characters', `${'a'.repeat(250)}@example.invalid`],
  ])('refuses %s', (_what, raw) => {
    expect(normaliseEmail(raw)).toBeNull();
  });
});

describe('defaultInvitationExpiry', () => {
  it('is fourteen days after the given moment', () => {
    const now = new Date('2026-10-24T08:00:00.000Z');
    expect(defaultInvitationExpiry(now).toISOString()).toBe('2026-11-07T08:00:00.000Z');
  });
});
