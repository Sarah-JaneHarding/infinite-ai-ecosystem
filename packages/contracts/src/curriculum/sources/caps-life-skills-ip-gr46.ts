import { z } from 'zod';

import { SourceRef } from '../framework.js';

export const CAPS_IP_LIFE_SKILLS_GR46_DOC_ID = 'caps-life-skills-ip-gr46-2011' as const;
export const CAPS_IP_LIFE_SKILLS_GR46_VERSION = '2011-ratified' as const;

function ref(clause: string, page: number): SourceRef {
  return {
    documentId: CAPS_IP_LIFE_SKILLS_GR46_DOC_ID,
    documentVersion: CAPS_IP_LIFE_SKILLS_GR46_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const IPLifeSkillsStudyAreaId = z.enum([
  'creative-arts',
  'personal-and-social-well-being',
  'physical-education',
]);
export type IPLifeSkillsStudyAreaId = z.infer<typeof IPLifeSkillsStudyAreaId>;

export const StudyAreaAnnualAllocation = z.object({
  studyAreaId: IPLifeSkillsStudyAreaId,
  name: z.string().min(1),
  hoursPerYear: z.object({
    grade4: z.number().positive(),
    grade5: z.number().positive(),
    grade6: z.number().positive(),
  }),
  source: SourceRef,
});
export type StudyAreaAnnualAllocation = z.infer<typeof StudyAreaAnnualAllocation>;

// Life Skills IP total hours per year per grade (hours/week × 40 weeks), §2.3, p.10.
export const EXPECTED_IP_LIFE_SKILLS_ANNUAL_HOURS = {
  grade4: 160,
  grade5: 160,
  grade6: 160,
} as const;

export const CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS: readonly StudyAreaAnnualAllocation[] =
  [
    {
      studyAreaId: 'personal-and-social-well-being',
      name: 'Personal and Social Well-being',
      hoursPerYear: { grade4: 60, grade5: 60, grade6: 60 },
      source: ref('§2.3–§2.4 Weighting of Study Areas', 10),
    },
    {
      studyAreaId: 'physical-education',
      name: 'Physical Education',
      hoursPerYear: { grade4: 40, grade5: 40, grade6: 40 },
      source: ref('§2.3–§2.4 Weighting of Study Areas', 10),
    },
    {
      studyAreaId: 'creative-arts',
      name: 'Creative Arts',
      hoursPerYear: { grade4: 60, grade5: 60, grade6: 60 },
      source: ref('§2.3–§2.4 Weighting of Study Areas', 10),
    },
  ];

export interface CapsIPLifeSkillsGr46Metadata {
  readonly documentId: string;
  readonly documentVersion: string;
  readonly title: string;
  readonly publisher: string;
  readonly isbn: string;
  readonly status: 'RATIFIED';
  readonly phase: 'INTERMEDIATE';
  readonly grades: readonly string[];
  readonly subjectName: string;
  readonly ratifiedBy: null;
  readonly pageCount: number;
}

export const CAPS_IP_LIFE_SKILLS_GR46_METADATA: CapsIPLifeSkillsGr46Metadata = {
  documentId: CAPS_IP_LIFE_SKILLS_GR46_DOC_ID,
  documentVersion: CAPS_IP_LIFE_SKILLS_GR46_VERSION,
  title: 'Curriculum and Assessment Policy Statement: Life Skills, Grades 4-6',
  publisher: 'Department of Basic Education, Republic of South Africa',
  isbn: '978-1-4315-0491-6',
  status: 'RATIFIED',
  phase: 'INTERMEDIATE',
  grades: ['4', '5', '6'],
  subjectName: 'Life Skills',
  ratifiedBy: null,
  pageCount: 66,
};
