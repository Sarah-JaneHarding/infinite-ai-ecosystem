// The POPIA vocabularies are re-exported from one place so the modules agree with this
// package rather than with each other. This asserts the barrel stays complete.

import { describe, expect, it } from 'vitest';

import * as contracts from '../src/index.js';

describe('package export surface', () => {
  it('exports the POPIA vocabularies and the curriculum framework', () => {
    // Widened deliberately when the curriculum framework merged. The list is spelled out
    // rather than counted, so a stray export has to be added here by someone who looked at
    // it — which is the only reason a test like this earns its keep.
    expect(Object.keys(contracts).sort()).toEqual([
      'AssessmentWeighting',
      'ConsentDecision',
      'ConsentEntry',
      'ConsentEntryDraft',
      'ConsentSource',
      'CurriculumFramework',
      'DataCategory',
      'FrameworkNeedsInput',
      'FrameworkResult',
      'GradeFramework',
      'GradeLabel',
      'LawfulBasis',
      'PACKAGE_NAME',
      'PURPOSES',
      'Phase',
      'Purpose',
      'RetentionAnchor',
      'RetentionRule',
      'RetentionSchedule',
      'SourceRef',
      'Sourced',
      'SubjectFramework',
      'TimeAllocation',
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
