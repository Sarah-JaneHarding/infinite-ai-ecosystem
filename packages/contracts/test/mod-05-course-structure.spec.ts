// MOD-05 micro-course structure tests — Stage 12 step 6.
//
// PD-06 (Micro-Course Composer) must produce learning objects that satisfy
// structural completeness constraints:
//
// 1. 20–40 minute duration: totalEstimatedMinutes is schema-enforced.
// 2. exportable is always true (literal) — a non-exportable micro-course is
//    a schema violation, not a valid alternative status.
// 3. Each module carries a pedagogically typed content block (input, model,
//    deliberate_practice, check_for_understanding).
// 4. checkItems are required (min 1) — the course must assess learning.
// 5. citedSourceIds are required (min 1) — no uncited content.
//
// These tests are schema-level only — no live model calls.

import { describe, expect, it } from 'vitest';

import { MicroCourseModule, PD06Input, PD06Result } from '../src/mod-05/index.js';

const TENANT = '11111111-2222-3333-4444-555555555555';
const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const NOW = '2026-08-11T10:00:00.000Z';

const VALID_MODULE = {
  title: 'What is formative assessment?',
  type: 'input' as const,
  estimatedMinutes: 10,
  content: 'Formative assessment is the ongoing process of collecting evidence...',
  materials: ['sticky notes', 'mini whiteboards'],
};

const VALID_OK: Record<string, unknown> = {
  status: 'ok',
  tenantId: TENANT,
  generatedAt: NOW,
  courseId: UUID,
  title: 'Formative Assessment Techniques',
  targetGap: 'formative_assessment',
  totalEstimatedMinutes: 30,
  modules: [VALID_MODULE],
  checkItems: ['What is one formative assessment technique you will use this week?'],
  citedSourceIds: ['doc-fa-001'],
  exportable: true,
};

// ---------------------------------------------------------------------------
// PD06Input
// ---------------------------------------------------------------------------

describe('PD06Input', () => {
  const validInput = {
    tenantId: TENANT,
    gap: { area: 'formative_assessment', urgency: 'high' },
    sourceDocumentIds: ['doc-001'],
    targetDurationMinutes: 30,
    language: 'en',
  };

  it('accepts a valid input', () => {
    expect(PD06Input.safeParse(validInput).success).toBe(true);
  });

  it('rejects empty sourceDocumentIds', () => {
    expect(PD06Input.safeParse({ ...validInput, sourceDocumentIds: [] }).success).toBe(
      false,
    );
  });

  it('rejects targetDurationMinutes < 20', () => {
    expect(
      PD06Input.safeParse({ ...validInput, targetDurationMinutes: 19 }).success,
    ).toBe(false);
  });

  it('rejects targetDurationMinutes > 40', () => {
    expect(
      PD06Input.safeParse({ ...validInput, targetDurationMinutes: 41 }).success,
    ).toBe(false);
  });

  it('accepts targetDurationMinutes at the boundaries (20 and 40)', () => {
    expect(
      PD06Input.safeParse({ ...validInput, targetDurationMinutes: 20 }).success,
    ).toBe(true);
    expect(
      PD06Input.safeParse({ ...validInput, targetDurationMinutes: 40 }).success,
    ).toBe(true);
  });

  it('rejects a language code shorter than 2 characters', () => {
    expect(PD06Input.safeParse({ ...validInput, language: 'e' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MicroCourseModule
// ---------------------------------------------------------------------------

describe('MicroCourseModule', () => {
  it('accepts all four valid module types', () => {
    const types = [
      'input',
      'model',
      'deliberate_practice',
      'check_for_understanding',
    ] as const;
    for (const type of types) {
      expect(MicroCourseModule.safeParse({ ...VALID_MODULE, type }).success).toBe(true);
    }
  });

  it('rejects an unknown module type', () => {
    expect(MicroCourseModule.safeParse({ ...VALID_MODULE, type: 'quiz' }).success).toBe(
      false,
    );
  });

  it('requires estimatedMinutes to be a positive integer', () => {
    expect(
      MicroCourseModule.safeParse({ ...VALID_MODULE, estimatedMinutes: 0 }).success,
    ).toBe(false);
    expect(
      MicroCourseModule.safeParse({ ...VALID_MODULE, estimatedMinutes: -5 }).success,
    ).toBe(false);
    expect(
      MicroCourseModule.safeParse({ ...VALID_MODULE, estimatedMinutes: 7.5 }).success,
    ).toBe(false);
  });

  it('requires non-empty content', () => {
    expect(MicroCourseModule.safeParse({ ...VALID_MODULE, content: '' }).success).toBe(
      false,
    );
  });

  it('accepts an empty materials array (no external materials required)', () => {
    expect(MicroCourseModule.safeParse({ ...VALID_MODULE, materials: [] }).success).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// PD06Result — duration and structural constraints
// ---------------------------------------------------------------------------

describe('PD06Result ok — duration constraint (20–40 minutes)', () => {
  it('accepts totalEstimatedMinutes = 20 (lower boundary)', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, totalEstimatedMinutes: 20 }).success).toBe(
      true,
    );
  });

  it('accepts totalEstimatedMinutes = 40 (upper boundary)', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, totalEstimatedMinutes: 40 }).success).toBe(
      true,
    );
  });

  it('rejects totalEstimatedMinutes < 20', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, totalEstimatedMinutes: 19 }).success).toBe(
      false,
    );
  });

  it('rejects totalEstimatedMinutes > 40', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, totalEstimatedMinutes: 41 }).success).toBe(
      false,
    );
  });
});

describe('PD06Result ok — exportable: true invariant', () => {
  it('accepts exportable: true', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, exportable: true }).success).toBe(true);
  });

  it('rejects exportable: false — non-exportable micro-course is a schema violation', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, exportable: false }).success).toBe(false);
  });

  it('rejects missing exportable field', () => {
    const { exportable: _e, ...withoutExportable } = VALID_OK;
    expect(PD06Result.safeParse(withoutExportable).success).toBe(false);
  });

  it('parsed ok result always has exportable === true', () => {
    const result = PD06Result.parse(VALID_OK);
    if (result.status === 'ok') {
      expect(result.exportable).toBe(true);
    } else {
      expect.fail('Expected ok status');
    }
  });
});

describe('PD06Result ok — content completeness', () => {
  it('requires at least one module', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, modules: [] }).success).toBe(false);
  });

  it('requires at least one checkItem', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, checkItems: [] }).success).toBe(false);
  });

  it('requires at least one citedSourceId — no uncited content', () => {
    expect(PD06Result.safeParse({ ...VALID_OK, citedSourceIds: [] }).success).toBe(false);
    const { citedSourceIds: _c, ...withoutCited } = VALID_OK;
    expect(PD06Result.safeParse(withoutCited).success).toBe(false);
  });

  it('accepts multiple modules', () => {
    const threeModules = [
      { ...VALID_MODULE },
      { ...VALID_MODULE, title: 'Modelled example', type: 'model' as const },
      { ...VALID_MODULE, title: 'Exit ticket', type: 'check_for_understanding' as const },
    ];
    expect(PD06Result.safeParse({ ...VALID_OK, modules: threeModules }).success).toBe(
      true,
    );
  });
});

describe('PD06Result needs_input path', () => {
  it('accepts needs_input when required inputs are absent', () => {
    const needsInput = {
      status: 'needs_input',
      detail: 'sourceDocumentIds is required but was empty.',
      missingFields: ['sourceDocumentIds'],
    };
    expect(PD06Result.safeParse(needsInput).success).toBe(true);
  });
});
