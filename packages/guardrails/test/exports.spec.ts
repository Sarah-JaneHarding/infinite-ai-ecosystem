// What the package offers, and specifically what it does not: rule 4 says there is no
// escape hatch on the egress guard, and the export list is where one would be added.

import { describe, expect, it } from 'vitest';

import * as guardrails from '../src/index.js';

describe('package export surface', () => {
  it('exports the guard and its throwing form, and nothing else', () => {
    expect(Object.keys(guardrails).sort()).toEqual([
      'PACKAGE_NAME',
      'PiiEgressError',
      'assertEgressAllowed',
      'inspectEgress',
    ]);
  });

  it('exports no bypass, allow-list or force flag', () => {
    // Each of these would be added for a good reason on a busy afternoon. Naming them here
    // means the diff that adds one also has to delete this test, which is a conversation.
    for (const name of Object.keys(guardrails)) {
      expect(name.toLowerCase()).not.toMatch(
        /bypass|allowlist|force|skip|override|disable/,
      );
    }
  });
});
