import { describe, expect, it } from 'vitest';

import { SIGN_IN_OUTCOMES, readOutcome } from '../../src/lib/sign-in-outcome';

describe('readOutcome', () => {
  it.each(SIGN_IN_OUTCOMES.map((o) => [o]))('accepts %s', (outcome) => {
    expect(readOutcome(outcome)).toBe(outcome);
  });

  it.each([[undefined], [null], [''], ['teacher'], [42], [{}], [['linked']]])(
    'reads %j as no outcome (a token from before this existed, or tampered with)',
    (raw) => {
      expect(readOutcome(raw)).toBeNull();
    },
  );
});
