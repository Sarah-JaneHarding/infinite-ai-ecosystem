// Derived structure extracted from:
//   "Draft CAPS — Coding and Robotics, Grades R-3"
//   DBE Republic of South Africa, 19 March 2021 (DRAFT)
//
// STORES DERIVED STRUCTURE ONLY per OQ-005: strand identifiers, grade ranges, and time
// allocations. No source text is reproduced here. The source PDF was supplied by a human
// and its provenance is recorded in:
//   docs/sources/caps/foundation/coding-robotics/SOURCES.md
//
// Status: DRAFT document — ratifiedBy is null throughout. The GradeFramework.ratifiedAt
// gate blocks publication until a human countersigns the extraction into L0.
//
// This document does NOT contain topic-level Annual Teaching Plans. Per-term topic
// sequences for Grades R-3 Coding and Robotics require a separate ATP document.

import { z } from 'zod';
import { SourceRef } from '../framework.js';

// ---------------------------------------------------------------------------
// Document identity
// ---------------------------------------------------------------------------

export const CAPS_CODING_ROBOTICS_R3_DOC_ID =
  'caps-coding-robotics-r3-draft-2021' as const;
export const CAPS_CODING_ROBOTICS_R3_VERSION = '2021-03-19-draft' as const;

function ref(clause: string, page: number): SourceRef {
  return {
    documentId: CAPS_CODING_ROBOTICS_R3_DOC_ID,
    documentVersion: CAPS_CODING_ROBOTICS_R3_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

// ---------------------------------------------------------------------------
// Strand identifiers
// ---------------------------------------------------------------------------

/**
 * Machine-readable identifiers for the five knowledge strands.
 * Source: §2 Content Areas, Grades R-3 Coding and Robotics, pp. 7-15.
 */
export const CodingRoboticsStrandId = z.enum([
  'pattern-recognition-problem-solving',
  'algorithms-coding',
  'robotic-skills',
  'internet-ecommunication-skills',
  'application-skills',
]);
export type CodingRoboticsStrandId = z.infer<typeof CodingRoboticsStrandId>;

// ---------------------------------------------------------------------------
// Time allocation schema
// ---------------------------------------------------------------------------

/**
 * Hours allocated to one strand in one grade over a single 10-week term.
 *
 * §2.4.1 (p.15) shows the same distribution for all four terms, so one entry
 * covers the full year. Grade totals must equal hoursPerWeek × 10 weeks:
 *   Grade R–2 → 10 h/term  (1 h/week)
 *   Grade 3   → 20 h/term  (2 h/week)
 */
export const StrandTermAllocation = z.object({
  strandId: CodingRoboticsStrandId,
  /** Human-readable strand name as it appears in the source document. */
  name: z.string().min(1),
  /** Hours per strand per 10-week term. Same value applies to all four terms. */
  hoursPerTerm: z.object({
    gradeR: z.number().positive(),
    grade1: z.number().positive(),
    grade2: z.number().positive(),
    grade3: z.number().positive(),
  }),
  source: SourceRef,
});
export type StrandTermAllocation = z.infer<typeof StrandTermAllocation>;

/** Expected per-grade totals (hours/term) for cross-validation. */
export const EXPECTED_TERM_HOURS = {
  gradeR: 10,
  grade1: 10,
  grade2: 10,
  grade3: 20,
} as const;

// ---------------------------------------------------------------------------
// Strand data — derived from §2.4.1 Time Allocation Table, p.15
// ---------------------------------------------------------------------------

/**
 * The five knowledge strands for Coding and Robotics, Grades R-3.
 *
 * All values sourced from §2.4.1, Time Allocation Table, p.15. The same
 * allocation applies across all four terms (§2.4.1 shows no per-term
 * variation).
 */
export const CAPS_CR_R3_STRANDS: readonly StrandTermAllocation[] = [
  {
    strandId: 'pattern-recognition-problem-solving',
    name: 'Pattern Recognition and Problem Solving',
    hoursPerTerm: { gradeR: 3, grade1: 2.5, grade2: 1.5, grade3: 2 },
    source: ref('§2.4.1, Time Allocation Table', 15),
  },
  {
    strandId: 'algorithms-coding',
    name: 'Algorithms and Coding',
    hoursPerTerm: { gradeR: 2, grade1: 2, grade2: 2.5, grade3: 4 },
    source: ref('§2.4.1, Time Allocation Table', 15),
  },
  {
    strandId: 'robotic-skills',
    name: 'Robotic Skills',
    hoursPerTerm: { gradeR: 1, grade1: 1.5, grade2: 2, grade3: 7 },
    source: ref('§2.4.1, Time Allocation Table', 15),
  },
  {
    strandId: 'internet-ecommunication-skills',
    name: 'Internet and e-Communication Skills',
    hoursPerTerm: { gradeR: 1, grade1: 1, grade2: 1, grade3: 3 },
    source: ref('§2.4.1, Time Allocation Table', 15),
  },
  {
    strandId: 'application-skills',
    name: 'Application Skills',
    hoursPerTerm: { gradeR: 3, grade1: 3, grade2: 3, grade3: 4 },
    source: ref('§2.4.1, Time Allocation Table', 15),
  },
];

// ---------------------------------------------------------------------------
// Document-level metadata
// ---------------------------------------------------------------------------

export interface CapsCodingRoboticsR3Metadata {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly publisher: string;
  readonly status: 'DRAFT' | 'RATIFIED';
  /** Phase this document covers. */
  readonly phase: 'FOUNDATION';
  /** Grades covered by this document. */
  readonly grades: readonly string[];
  /** Subject name as stated in the document. */
  readonly subjectName: string;
  /** Whether this has been countersigned into L0 by a human. */
  readonly ratifiedBy: null;
  /** Page count of the source PDF as supplied. */
  readonly pageCount: number;
}

export const CAPS_CR_R3_METADATA: CapsCodingRoboticsR3Metadata = {
  documentId: CAPS_CODING_ROBOTICS_R3_DOC_ID,
  documentVersion: CAPS_CODING_ROBOTICS_R3_VERSION,
  title: 'Curriculum and Assessment Policy Statement: Coding and Robotics, Grades R-3',
  publisher: 'Department of Basic Education, Republic of South Africa',
  status: 'DRAFT',
  phase: 'FOUNDATION',
  grades: ['R', '1', '2', '3'],
  subjectName: 'Coding and Robotics',
  ratifiedBy: null,
  pageCount: 18,
};
