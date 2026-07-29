// The POPIA vocabularies are re-exported from one place so the modules agree with this
// package rather than with each other. This asserts the barrel stays complete.

import { describe, expect, it } from 'vitest';

import * as contracts from '../src/index.js';

describe('package export surface', () => {
  it('exports the purpose, consent and retention vocabularies', () => {
    expect(Object.keys(contracts).sort()).toEqual([
      'ConsentDecision',
      'ConsentEntry',
      'ConsentEntryDraft',
      'ConsentSource',
      'DataCategory',
      'LawfulBasis',
      'PACKAGE_NAME',
      'PURPOSES',
      'Purpose',
      'RetentionAnchor',
      'RetentionRule',
      'RetentionSchedule',
      'WITHDRAWABLE_BASES',
      'addMonths',
      'definitionOf',
      'evaluateRetention',
      'isWithdrawable',
      'permits',
      'projectCategories',
      'ruleFor',
      'unscheduledCategories',
    ]);
  });

  it('ships no retention schedule, default or example', () => {
    // The periods are each school's legal determination, ratified in its L0 constitution.
    // An exported default here would be adopted by every tenant that never got round to
    // ratifying one, which is the opposite of what ratification is for. See OQ-007.
    for (const [name, value] of Object.entries(contracts)) {
      if (!Array.isArray(value)) continue;
      expect(
        value.some(
          (entry) =>
            typeof entry === 'object' && entry !== null && 'retainMonths' in entry,
        ),
        `${name} contains a retention period`,
      ).toBe(false);
    }
  });
});
