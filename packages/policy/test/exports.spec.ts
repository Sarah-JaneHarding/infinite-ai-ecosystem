// What the package offers, and — more usefully — what it does not.

import { describe, expect, it } from 'vitest';

import * as policy from '../src/index.js';

describe('package export surface', () => {
  it('exports the decision functions and nothing that reaches a database', () => {
    expect(Object.keys(policy).sort()).toEqual([
      'PACKAGE_NAME',
      'auditPayload',
      'endsProcessing',
      'evaluateConsent',
      'isEmpty',
      'relevantEntries',
      'resolveAccess',
      'unresolvedObjections',
    ]);
  });

  it('offers no way to reach an ambient clock', () => {
    // Every function that cares about time takes it as an argument. A `Date.now()` hidden
    // in here would make "were we permitted to do this last March?" unanswerable, which is
    // the one question the ledger exists to answer.
    for (const [name, value] of Object.entries(policy)) {
      if (typeof value !== 'function') continue;
      expect(
        value.length,
        `${name} takes no arguments, so it must read time or state`,
      ).toBeGreaterThan(0);
    }
  });
});
