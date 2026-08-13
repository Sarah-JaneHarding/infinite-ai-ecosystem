import { z } from 'zod';

import { SourceRef } from '../framework.js';

export const CAPS_LIFE_SKILLS_R3_DOC_ID = 'caps-life-skills-r3-2011' as const;
export const CAPS_LIFE_SKILLS_R3_VERSION = '2011-ratified' as const;

function ref(clause: string, page: number): SourceRef {
  return {
    documentId: CAPS_LIFE_SKILLS_R3_DOC_ID,
    documentVersion: CAPS_LIFE_SKILLS_R3_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const LifeSkillsStudyAreaId = z.enum([
  'beginning-knowledge',
  'creative-arts',
  'physical-education',
  'personal-and-social-well-being',
]);
export type LifeSkillsStudyAreaId = z.infer<typeof LifeSkillsStudyAreaId>;

export const StudyAreaTermAllocation = z.object({
  studyAreaId: LifeSkillsStudyAreaId,
  name: z.string().min(1),
  hoursPerTerm: z.object({
    gradeR: z.number().positive(),
    grade1: z.number().positive(),
    grade2: z.number().positive(),
    grade3: z.number().positive(),
  }),
  source: SourceRef,
});
export type StudyAreaTermAllocation = z.infer<typeof StudyAreaTermAllocation>;

// Life Skills total hours per term per grade (hours/week × 10 weeks), §1.4.1, p.6.
export const EXPECTED_LIFE_SKILLS_TERM_HOURS = {
  gradeR: 60,
  grade1: 60,
  grade2: 60,
  grade3: 70,
} as const;

export const CAPS_LIFE_SKILLS_R3_STUDY_AREAS: readonly StudyAreaTermAllocation[] = [
  {
    studyAreaId: 'beginning-knowledge',
    name: 'Beginning Knowledge',
    hoursPerTerm: { gradeR: 10, grade1: 10, grade2: 10, grade3: 20 },
    source: ref('§1.4.1 Foundation Phase Time Allocation, Table 1', 6),
  },
  {
    studyAreaId: 'creative-arts',
    name: 'Creative Arts',
    hoursPerTerm: { gradeR: 20, grade1: 20, grade2: 20, grade3: 20 },
    source: ref('§1.4.1 Foundation Phase Time Allocation, Table 1', 6),
  },
  {
    studyAreaId: 'physical-education',
    name: 'Physical Education',
    hoursPerTerm: { gradeR: 20, grade1: 20, grade2: 20, grade3: 20 },
    source: ref('§1.4.1 Foundation Phase Time Allocation, Table 1', 6),
  },
  {
    studyAreaId: 'personal-and-social-well-being',
    name: 'Personal and Social Well-being',
    hoursPerTerm: { gradeR: 10, grade1: 10, grade2: 10, grade3: 10 },
    source: ref('§1.4.1 Foundation Phase Time Allocation, Table 1', 6),
  },
];

export interface CapsLifeSkillsR3Metadata {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly publisher: string;
  readonly isbn: string;
  readonly status: 'RATIFIED';
  readonly phase: 'FOUNDATION';
  readonly grades: readonly string[];
  readonly subjectName: string;
  readonly ratifiedBy: null;
  readonly pageCount: number;
}

export const CAPS_LIFE_SKILLS_R3_METADATA: CapsLifeSkillsR3Metadata = {
  documentId: CAPS_LIFE_SKILLS_R3_DOC_ID,
  documentVersion: CAPS_LIFE_SKILLS_R3_VERSION,
  title: 'Curriculum and Assessment Policy Statement: Life Skills, Grades R-3',
  publisher: 'Department of Basic Education, Republic of South Africa',
  isbn: '978-1-4315-0422-0',
  status: 'RATIFIED',
  phase: 'FOUNDATION',
  grades: ['R', '1', '2', '3'],
  subjectName: 'Life Skills',
  ratifiedBy: null,
  pageCount: 74,
};
