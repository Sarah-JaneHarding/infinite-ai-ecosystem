import { z } from 'zod';

import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DOE_WSE_POLICY_2001_DOC_ID = 'doe-wse-policy-2001' as const;
export const DOE_WSE_POLICY_2001_VERSION = '2001-07' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DOE_WSE_POLICY_2001_DOC_ID,
    documentVersion: DOE_WSE_POLICY_2001_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

// The seven evaluation areas stated in §5 of the WSE Policy, in order.
export const WSE_EVALUATION_AREAS = [
  'School management and leadership',
  'Governance and relationships with parents and community',
  'Teaching and learning',
  'Curriculum provision',
  'Human resource management and development',
  'Physical environment',
  'Parents and community',
] as const;

export type WseEvaluationArea = (typeof WSE_EVALUATION_AREAS)[number];

// Performance ratings as stated in the WSE Policy: 1 (not achieved) → 4 (outstanding).
export const WsePerformanceRating = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type WsePerformanceRating = z.infer<typeof WsePerformanceRating>;

export const DOE_WSE_POLICY_2001_SECTIONS = {
  /** Aims and purposes of Whole-School Evaluation. */
  aims: ref('§3 Aims and Purposes of Whole-School Evaluation', 3),
  /** Principles underpinning WSE. */
  principles: ref('§4 Principles of WSE', 5),
  /** The seven evaluation areas and their descriptors. */
  evaluationAreas: ref('§5 Areas of Evaluation', 7),
  /** Four-point performance rating scale. */
  performanceRatings: ref('§6 Performance Ratings (1 Not Achieved — 4 Outstanding)', 10),
  /** The WSE process: scheduling, conducting and reporting evaluations. */
  evaluationProcess: ref('§7 The WSE Process', 11),
  /** Roles and responsibilities at national, provincial, district and school levels. */
  responsibilities: ref('§8 Responsibilities of Key Stakeholders', 14),
} as const;

export const DOE_WSE_POLICY_2001_METADATA: PolicyDocMetadata = {
  documentId: DOE_WSE_POLICY_2001_DOC_ID,
  documentVersion: DOE_WSE_POLICY_2001_VERSION,
  title: 'The National Policy on Whole-School Evaluation',
  publisher: 'Department of Education, Republic of South Africa',
  kind: 'POLICY',
  gazetteRef: 'Government Gazette Vol. 433, No. 22512, July 2001',
  isbnOrIssn: '1-919917-04-9',
  ratifiedBy: null,
};
