import { z } from 'zod';

export const SA_LANGUAGES = [
  'Afrikaans',
  'English',
  'isiNdebele',
  'isiXhosa',
  'isiZulu',
  'Sesotho',
  'Sesotho sa Leboa (Sepedi)',
  'Setswana',
  'siSwati',
  'Tshivenda',
  'Xitsonga',
] as const;

export type SaLanguage = (typeof SA_LANGUAGES)[number];

export const CAPS_PHASES = ['Foundation', 'Intermediate', 'Senior'] as const;
export type CapsPhase = (typeof CAPS_PHASES)[number];

export const GRADES_BY_PHASE: Readonly<Record<CapsPhase, readonly string[]>> = {
  Foundation: ['Grade R', 'Grade 1', 'Grade 2', 'Grade 3'],
  Intermediate: ['Grade 4', 'Grade 5', 'Grade 6'],
  Senior: ['Grade 7', 'Grade 8', 'Grade 9'],
};

export const ALL_GRADES = [
  ...GRADES_BY_PHASE.Foundation,
  ...GRADES_BY_PHASE.Intermediate,
  ...GRADES_BY_PHASE.Senior,
] as const;

export const CAPS_SUBJECTS = [
  'English Home Language',
  'First Additional Language (FAL)',
  'Mathematics',
  'Life Skills (Foundation Phase)',
  'Life Skills (Intermediate Phase)',
  'Natural Sciences & Technology',
  'Social Sciences',
  'Economic & Management Sciences',
  'Creative Arts',
  'Technology',
  'Life Orientation',
] as const;

export type CapsSubject = (typeof CAPS_SUBJECTS)[number];

export const STAFF_ROLES = ['Class Teacher', 'Subject Specialist'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const LanguageSettings = z.object({
  lolt: z.enum(SA_LANGUAGES),
  fal: z.array(z.enum(SA_LANGUAGES)).min(1, 'At least one FAL is required'),
  sal: z.array(z.enum(SA_LANGUAGES)).optional(),
});
export type LanguageSettings = z.infer<typeof LanguageSettings>;

export const TermWeeks = z.object({
  term1: z.number().int().min(1).max(13),
  term2: z.number().int().min(1).max(13),
  term3: z.number().int().min(1).max(13),
  term4: z.number().int().min(1).max(13),
});
export type TermWeeks = z.infer<typeof TermWeeks>;

export const SubjectGradePeriods = z.object({
  subject: z.string().min(1),
  grades: z.array(z.string()).min(1, 'At least one grade is required'),
  hoursPerWeek: z.number().positive(),
});
export type SubjectGradePeriods = z.infer<typeof SubjectGradePeriods>;

export const StaffMember = z.object({
  name: z.string().min(1),
  role: z.enum(STAFF_ROLES),
});
export type StaffMember = z.infer<typeof StaffMember>;

export const SchoolConfig = z
  .object({
    tenantId: z.string().uuid(),
    schoolName: z.string().min(1),
    academicYear: z.number().int().min(2024).max(2099),
    languages: LanguageSettings,
    termWeeks: TermWeeks,
    subjects: z.array(SubjectGradePeriods).min(1, 'At least one subject is required'),
    staff: z.array(StaffMember),
    configuredAt: z.string().datetime(),
    configuredBy: z.string().min(1),
  })
  .strict();
export type SchoolConfig = z.infer<typeof SchoolConfig>;
