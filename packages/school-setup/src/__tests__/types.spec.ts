import { describe, expect, it } from 'vitest';
import {
  LanguageSettings,
  SchoolConfig,
  StaffMember,
  SubjectGradePeriods,
  TermWeeks,
} from '../types.js';
import { periodsFromHours, totalWeeks, validateLanguageConflicts } from '../validate.js';

describe('LanguageSettings', () => {
  it('accepts valid LOLT + FAL', () => {
    expect(() =>
      LanguageSettings.parse({ lolt: 'English', fal: ['Afrikaans'] }),
    ).not.toThrow();
  });

  it('accepts optional SAL', () => {
    expect(() =>
      LanguageSettings.parse({
        lolt: 'English',
        fal: ['Afrikaans'],
        sal: ['isiZulu'],
      }),
    ).not.toThrow();
  });

  it('rejects empty FAL array', () => {
    expect(() => LanguageSettings.parse({ lolt: 'English', fal: [] })).toThrow();
  });

  it('rejects a language not in the SA_LANGUAGES enum', () => {
    expect(() => LanguageSettings.parse({ lolt: 'Klingon', fal: ['English'] })).toThrow();
  });

  it('rejects missing lolt', () => {
    expect(() => LanguageSettings.parse({ fal: ['English'] })).toThrow();
  });
});

describe('validateLanguageConflicts', () => {
  it('returns null when no overlaps', () => {
    expect(validateLanguageConflicts({ lolt: 'English', fal: ['Afrikaans'] })).toBeNull();
  });

  it('returns error when LOLT appears in FAL', () => {
    const result = validateLanguageConflicts({
      lolt: 'English',
      fal: ['English', 'Afrikaans'],
    });
    expect(result).toContain('English');
  });

  it('returns error when LOLT appears in SAL', () => {
    const result = validateLanguageConflicts({
      lolt: 'Afrikaans',
      fal: ['English'],
      sal: ['Afrikaans'],
    });
    expect(result).toContain('Afrikaans');
  });

  it('returns error when FAL and SAL share a language', () => {
    const result = validateLanguageConflicts({
      lolt: 'English',
      fal: ['Afrikaans'],
      sal: ['Afrikaans'],
    });
    expect(result).toContain('Afrikaans');
  });
});

describe('TermWeeks', () => {
  it('accepts standard SA term structure', () => {
    expect(() =>
      TermWeeks.parse({ term1: 10, term2: 10, term3: 11, term4: 7 }),
    ).not.toThrow();
  });

  it('rejects term weeks exceeding 13', () => {
    expect(() =>
      TermWeeks.parse({ term1: 14, term2: 10, term3: 11, term4: 7 }),
    ).toThrow();
  });

  it('rejects zero weeks', () => {
    expect(() => TermWeeks.parse({ term1: 0, term2: 10, term3: 11, term4: 7 })).toThrow();
  });

  it('rejects fractional weeks', () => {
    expect(() =>
      TermWeeks.parse({ term1: 10.5, term2: 10, term3: 11, term4: 7 }),
    ).toThrow();
  });
});

describe('SubjectGradePeriods', () => {
  it('accepts valid subject configuration', () => {
    expect(() =>
      SubjectGradePeriods.parse({
        subject: 'Mathematics',
        grades: ['Grade 4', 'Grade 5'],
        hoursPerWeek: 5,
      }),
    ).not.toThrow();
  });

  it('rejects empty grades array', () => {
    expect(() =>
      SubjectGradePeriods.parse({ subject: 'Mathematics', grades: [], hoursPerWeek: 5 }),
    ).toThrow();
  });

  it('rejects zero hoursPerWeek', () => {
    expect(() =>
      SubjectGradePeriods.parse({
        subject: 'Mathematics',
        grades: ['Grade 4'],
        hoursPerWeek: 0,
      }),
    ).toThrow();
  });
});

describe('StaffMember', () => {
  it('accepts a Class Teacher', () => {
    expect(() =>
      StaffMember.parse({ name: 'Ms Sarah Nkosi', role: 'Class Teacher' }),
    ).not.toThrow();
  });

  it('accepts a Subject Specialist', () => {
    expect(() =>
      StaffMember.parse({ name: 'Mr Dlamini', role: 'Subject Specialist' }),
    ).not.toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() => StaffMember.parse({ name: 'Test', role: 'Principal' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => StaffMember.parse({ name: '', role: 'Class Teacher' })).toThrow();
  });
});

describe('SchoolConfig', () => {
  const validConfig = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    schoolName: 'Benjamin Pine Primary School',
    academicYear: 2026,
    languages: { lolt: 'English', fal: ['Afrikaans'] },
    termWeeks: { term1: 10, term2: 10, term3: 11, term4: 7 },
    subjects: [{ subject: 'Mathematics', grades: ['Grade 4'], hoursPerWeek: 5 }],
    staff: [{ name: 'Ms Nkosi', role: 'Class Teacher' }],
    configuredAt: '2026-01-01T08:00:00.000Z',
    configuredBy: 'admin@school.ac.za',
  };

  it('accepts a fully valid config', () => {
    expect(() => SchoolConfig.parse(validConfig)).not.toThrow();
  });

  it('rejects an invalid tenantId (not UUID)', () => {
    expect(() =>
      SchoolConfig.parse({ ...validConfig, tenantId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('rejects an academic year before 2024', () => {
    expect(() => SchoolConfig.parse({ ...validConfig, academicYear: 2023 })).toThrow();
  });

  it('rejects extra unknown fields (strict schema)', () => {
    expect(() => SchoolConfig.parse({ ...validConfig, extraField: 'oops' })).toThrow();
  });
});

describe('periodsFromHours', () => {
  it('converts 4 h → 8 periods', () => {
    expect(periodsFromHours(4)).toBe(8);
  });

  it('converts 2.5 h → 5 periods', () => {
    expect(periodsFromHours(2.5)).toBe(5);
  });

  it('converts 1 h → 2 periods', () => {
    expect(periodsFromHours(1)).toBe(2);
  });
});

describe('totalWeeks', () => {
  it('sums all four terms', () => {
    expect(totalWeeks({ term1: 10, term2: 10, term3: 11, term4: 7 })).toBe(38);
  });
});
