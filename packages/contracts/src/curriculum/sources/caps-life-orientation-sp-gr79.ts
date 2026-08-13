import { z } from 'zod';

import { SourceRef } from '../framework.js';

export const CAPS_LO_SP_GR79_DOC_ID = 'caps-life-orientation-sp-gr79-2011' as const;
export const CAPS_LO_SP_GR79_VERSION = '2011-ratified' as const;

function ref(clause: string, page: number): SourceRef {
  return {
    documentId: CAPS_LO_SP_GR79_DOC_ID,
    documentVersion: CAPS_LO_SP_GR79_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const LifeOrientationTopicId = z.enum([
  'constitutional-rights-and-responsibilities',
  'development-of-self-in-society',
  'health-social-environmental-responsibility',
  'physical-education',
  'world-of-work',
]);
export type LifeOrientationTopicId = z.infer<typeof LifeOrientationTopicId>;

export const TopicAnnualAllocation = z.object({
  topicId: LifeOrientationTopicId,
  name: z.string().min(1),
  hoursPerYear: z.object({
    grade7: z.number().positive(),
    grade8: z.number().positive(),
    grade9: z.number().positive(),
  }),
  source: SourceRef,
});
export type TopicAnnualAllocation = z.infer<typeof TopicAnnualAllocation>;

// Life Orientation SP contact hours per year per grade (excluding exams), §2.4, p.9.
// The 40-week year has 10h reserved for exams; the 70h contact total is the policy floor.
export const EXPECTED_LO_CONTACT_HOURS = {
  grade7: 70,
  grade8: 70,
  grade9: 70,
} as const;

export const CAPS_LO_SP_GR79_TOPICS: readonly TopicAnnualAllocation[] = [
  {
    topicId: 'development-of-self-in-society',
    name: 'Development of the self in society',
    hoursPerYear: { grade7: 10, grade8: 9, grade9: 10 },
    source: ref('§2.4 Weighting of Topics', 9),
  },
  {
    topicId: 'health-social-environmental-responsibility',
    name: 'Health, social and environmental responsibility',
    hoursPerYear: { grade7: 10, grade8: 8, grade9: 7 },
    source: ref('§2.4 Weighting of Topics', 9),
  },
  {
    topicId: 'constitutional-rights-and-responsibilities',
    name: 'Constitutional rights and responsibilities',
    hoursPerYear: { grade7: 7, grade8: 9, grade9: 7 },
    source: ref('§2.4 Weighting of Topics', 9),
  },
  {
    topicId: 'world-of-work',
    name: 'World of work',
    hoursPerYear: { grade7: 8, grade8: 9, grade9: 11 },
    source: ref('§2.4 Weighting of Topics', 9),
  },
  {
    topicId: 'physical-education',
    name: 'Physical Education',
    hoursPerYear: { grade7: 35, grade8: 35, grade9: 35 },
    source: ref('§2.4 Weighting of Topics', 9),
  },
];

export interface CapsLOSpGr79Metadata {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly publisher: string;
  readonly isbn: string;
  readonly status: 'RATIFIED';
  readonly phase: 'SENIOR';
  readonly grades: readonly string[];
  readonly subjectName: string;
  readonly ratifiedBy: null;
  readonly pageCount: number;
}

export const CAPS_LO_SP_GR79_METADATA: CapsLOSpGr79Metadata = {
  documentId: CAPS_LO_SP_GR79_DOC_ID,
  documentVersion: CAPS_LO_SP_GR79_VERSION,
  title: 'Curriculum and Assessment Policy Statement: Life Orientation, Grades 7-9',
  publisher: 'Department of Basic Education, Republic of South Africa',
  isbn: '978-1-4315-0531-9',
  status: 'RATIFIED',
  phase: 'SENIOR',
  grades: ['7', '8', '9'],
  subjectName: 'Life Orientation',
  ratifiedBy: null,
  pageCount: 38,
};
