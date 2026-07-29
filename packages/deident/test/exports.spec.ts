// What the package offers. The list is short on purpose: a de-identification package that
// also exported a re-identification helper would put both sides of the mapping one import
// apart, and re-identification is an audited act that belongs behind a service.

import { describe, expect, it } from 'vitest';

import * as deident from '../src/index.js';

describe('package export surface', () => {
  it('exports the tokeniser and the scrubber, and no reverse mapping', () => {
    expect(Object.keys(deident).sort()).toEqual([
      'PACKAGE_NAME',
      'TOKEN_PATTERN',
      'TOKEN_PREFIXES',
      'TenantSalt',
      'TokenisationError',
      'containsDetectablePii',
      'isToken',
      'scrub',
      'tokenMatches',
      'tokenise',
    ]);
  });

  it('exports nothing that reverses a token', () => {
    // `tokenMatches` confirms a mapping the caller already holds; it does not produce one.
    // Anything named to suggest otherwise would be the wrong shape for this package.
    for (const name of Object.keys(deident)) {
      expect(name.toLowerCase()).not.toMatch(/detoken|reidentif|reverse|decode/);
    }
  });
});
