// The purpose taxonomy — Stage 03 step 2.
//
// POPIA's purpose-limitation principle says data collected for one reason may not be used
// for another. That is easy to state and easy to erode: the erosion always looks like a
// small reasonable extension, and there is never a moment where anyone decides to break
// the rule.
//
// So purpose is made a required argument on every learner-data query, and each purpose
// declares — here, in one table — exactly which data categories it may touch. A use that
// is not on the list is not a policy violation to be caught later; it is a set of columns
// that never arrive.
//
// Adding a purpose or widening one is a change to this file, which means it is a diff, a
// review and an update to docs/POPIA.md rather than a line of code somewhere in a module.

import { z } from 'zod';

/**
 * Categories of personal information, ordered roughly by sensitivity.
 *
 * The split is by *what the data is about*, not by which table it lives in, because
 * purpose limitation is a question about meaning rather than storage.
 */
export const DataCategory = z.enum([
  /** Tenant-salted pseudonym. The only identifier that may cross into a prompt. */
  'IDENTIFIER_TOKEN',
  /** Name, ID number, date of birth, address, contact details. */
  'DIRECT_IDENTIFIER',
  /** Grade, class, subjects, enrolment status. */
  'ENROLMENT',
  /** Marks, assessment results, academic progress. */
  'ACADEMIC_PERFORMANCE',
  /** Presence, absence, punctuality. */
  'ATTENDANCE',
  /** Conduct records, incidents. */
  'BEHAVIOUR',
  /** Screening scores, tier decisions, intervention history. */
  'SUPPORT_NEED',
  /**
   * Special personal information under POPIA §26: health, disability, biometrics.
   * Stricter handling, shorter retention, and no purpose below may touch it except
   * intervention — deliberately the narrowest grant in the table.
   */
  'SPECIAL_PERSONAL',
  /** Home language, guardian relationships, communication preferences. */
  'FAMILY_CONTEXT',
  /** Teacher-level practice data. Developmental only — see MOD-05's constraints. */
  'STAFF_PRACTICE',
]);
export type DataCategory = z.infer<typeof DataCategory>;

/** The declared purposes. Anything not listed here does not exist as a lawful use. */
export const Purpose = z.enum([
  'planning',
  'screening',
  'intervention',
  'reporting_parent',
  'reporting_district',
  'pd_analytics',
  'product_improvement',
  'learning_engine',
]);
export type Purpose = z.infer<typeof Purpose>;

export interface PurposeDefinition {
  readonly purpose: Purpose;
  /** What this purpose is for, in the words a school would recognise. */
  readonly description: string;
  /** The only categories a query under this purpose may return. */
  readonly categories: readonly DataCategory[];
  /** Whether data under this purpose may be re-identified by an authorised role. */
  readonly permitsReidentification: boolean;
  /** Whether de-identified text under this purpose may reach a model. */
  readonly permitsModelProcessing: boolean;
}

/**
 * The purpose table.
 *
 * Two properties are worth reading carefully, because they are where the real limits sit:
 *
 * `planning` cannot touch a single learner-level category. Lesson and term planning is
 * about curriculum, not children, and MOD-01 generating a plan has no business seeing a
 * learner's marks. This is what makes "no learner personal information in any planning
 * artefact" enforceable rather than aspirational.
 *
 * `product_improvement` — the purpose most likely to be stretched, since it sounds
 * harmless — touches nothing at all and permits no model processing. Improving the product
 * using a school's learner data is not a thing this system does. If it ever should, that
 * is a conversation with the school and a change to this row, not a quiet reinterpretation.
 */
export const PURPOSES: readonly PurposeDefinition[] = [
  {
    purpose: 'planning',
    description: 'Curriculum, term and lesson planning. Deliberately learner-blind.',
    categories: ['ENROLMENT'],
    permitsReidentification: false,
    permitsModelProcessing: true,
  },
  {
    purpose: 'screening',
    description:
      'Termly universal screening across literacy, numeracy, attendance and behaviour.',
    categories: [
      'IDENTIFIER_TOKEN',
      'ENROLMENT',
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
      'BEHAVIOUR',
    ],
    permitsReidentification: false,
    permitsModelProcessing: true,
  },
  {
    purpose: 'intervention',
    description: 'Planning, delivering and monitoring learner support.',
    categories: [
      'IDENTIFIER_TOKEN',
      'ENROLMENT',
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
      'BEHAVIOUR',
      'SUPPORT_NEED',
      'SPECIAL_PERSONAL',
      'FAMILY_CONTEXT',
    ],
    // The SBST needs to know which child. Re-identification is audited, not free.
    permitsReidentification: true,
    permitsModelProcessing: true,
  },
  {
    purpose: 'reporting_parent',
    description: "Progress reports to a learner's own guardians.",
    categories: [
      'IDENTIFIER_TOKEN',
      'DIRECT_IDENTIFIER',
      'ENROLMENT',
      'ACADEMIC_PERFORMANCE',
      'ATTENDANCE',
      'SUPPORT_NEED',
      'FAMILY_CONTEXT',
    ],
    // A parent report names the child; that is the point of it.
    permitsReidentification: true,
    permitsModelProcessing: true,
  },
  {
    purpose: 'reporting_district',
    description: 'Aggregate reporting to the district. De-identified, never individual.',
    categories: ['ENROLMENT', 'ACADEMIC_PERFORMANCE', 'ATTENDANCE'],
    permitsReidentification: false,
    permitsModelProcessing: true,
  },
  {
    purpose: 'pd_analytics',
    description: 'Teacher professional development analytics. Developmental only.',
    categories: ['STAFF_PRACTICE', 'ACADEMIC_PERFORMANCE'],
    permitsReidentification: false,
    permitsModelProcessing: true,
  },
  {
    purpose: 'product_improvement',
    description:
      'Improving the platform. Touches no learner data and reaches no model. Widening ' +
      'this is a conversation with the school, not a code change.',
    categories: [],
    permitsReidentification: false,
    permitsModelProcessing: false,
  },
  {
    purpose: 'learning_engine',
    description:
      'Tenant-local learning from teacher corrections and aggregated, de-identified outcome ' +
      'signals. Never individual learner data; never re-identification. Cross-school ' +
      'publication requires explicit opt-in and k-anonymity enforcement (Stage 13).',
    categories: ['STAFF_PRACTICE', 'ACADEMIC_PERFORMANCE'],
    permitsReidentification: false,
    permitsModelProcessing: true,
  },
];

const BY_PURPOSE = new Map(PURPOSES.map((p) => [p.purpose, p]));

export function definitionOf(purpose: Purpose): PurposeDefinition {
  const definition = BY_PURPOSE.get(purpose);
  // Unreachable while Purpose and PURPOSES agree, which a test asserts. Throwing rather
  // than returning a permissive default: a missing definition must never read as "allow".
  if (definition === undefined) {
    throw new Error(`No definition for purpose ${purpose}. Purpose table is incomplete.`);
  }
  return definition;
}

/** May a query under this purpose see this category at all? */
export function permits(purpose: Purpose, category: DataCategory): boolean {
  return definitionOf(purpose).categories.includes(category);
}

/**
 * The result of narrowing a set of requested categories to what a purpose allows.
 *
 * `dropped` is returned rather than thrown because the manual is specific: the data layer
 * "drops disallowed columns rather than failing silently. Log every drop." A hard failure
 * would push callers toward requesting less than they need in order to avoid errors, which
 * ends with someone passing a wider purpose to make the error go away. Dropping and
 * logging keeps the caller honest and the record complete.
 */
export interface CategoryProjection {
  readonly purpose: Purpose;
  readonly allowed: readonly DataCategory[];
  readonly dropped: readonly DataCategory[];
}

export function projectCategories(
  purpose: Purpose,
  requested: readonly DataCategory[],
): CategoryProjection {
  const definition = definitionOf(purpose);
  const allowed: DataCategory[] = [];
  const dropped: DataCategory[] = [];
  for (const category of requested) {
    (definition.categories.includes(category) ? allowed : dropped).push(category);
  }
  return { purpose, allowed, dropped };
}
