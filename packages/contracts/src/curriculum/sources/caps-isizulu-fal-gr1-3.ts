import { z } from 'zod';

import { SourceRef } from '../framework.js';

export const CAPS_ISIZULU_FAL_GR13_DOC_ID = 'caps-isizulu-fal-gr1-3-2011' as const;
export const CAPS_ISIZULU_FAL_GR13_VERSION = '2011-ratified' as const;

function ref(clause: string, page: number): SourceRef {
  return {
    documentId: CAPS_ISIZULU_FAL_GR13_DOC_ID,
    documentVersion: CAPS_ISIZULU_FAL_GR13_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const IsiZuluFALSkillId = z.enum([
  'listening-and-speaking',
  'reading-and-phonics',
  'writing',
  'language-use',
]);
export type IsiZuluFALSkillId = z.infer<typeof IsiZuluFALSkillId>;

// Language skill components use nonnegative (not positive) because Language Use is not
// allocated separate time in Grades 1-2 at the minimum timetable (§2.4, p.10-11).
export const FALSkillWeeklyAllocation = z.object({
  skillId: IsiZuluFALSkillId,
  name: z.string().min(1),
  zuluName: z.string().min(1),
  weeklyHoursMin: z.object({
    grade1: z.number().nonnegative(),
    grade2: z.number().nonnegative(),
    grade3: z.number().nonnegative(),
  }),
  source: SourceRef,
});
export type FALSkillWeeklyAllocation = z.infer<typeof FALSkillWeeklyAllocation>;

// Minimum weekly hours for the subject as a whole per grade (§2.4, p.10).
// Grade R is not covered — First Additional Language starts in Grade 1.
export const EXPECTED_FAL_WEEKLY_HOURS = {
  grade1: 2,
  grade2: 2,
  grade3: 3,
} as const;

export const CAPS_ISIZULU_FAL_GR13_SKILLS: readonly FALSkillWeeklyAllocation[] = [
  {
    skillId: 'listening-and-speaking',
    name: 'Listening and Speaking',
    zuluName: 'Ukulalela nokukhuluma',
    weeklyHoursMin: { grade1: 1.5, grade2: 0.75, grade3: 1 },
    source: ref('§2.4 Time Allocation — minimum timetable', 11),
  },
  {
    skillId: 'reading-and-phonics',
    name: 'Reading and Phonics',
    zuluName: 'Ukufunda nemisindo',
    weeklyHoursMin: { grade1: 0.5, grade2: 0.75, grade3: 1 },
    source: ref('§2.4 Time Allocation — minimum timetable', 11),
  },
  {
    skillId: 'writing',
    name: 'Writing',
    zuluName: 'Ukubhala',
    weeklyHoursMin: { grade1: 0, grade2: 0.5, grade3: 0.5 },
    source: ref('§2.4 Time Allocation — minimum timetable', 11),
  },
  {
    skillId: 'language-use',
    name: 'Language Use',
    zuluName: 'Ukusetshenziswa kolimi',
    weeklyHoursMin: { grade1: 0, grade2: 0, grade3: 0.5 },
    source: ref('§2.4 Time Allocation — minimum timetable', 11),
  },
];

export interface CapsIsiZuluFALGr13Metadata {
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

export const CAPS_ISIZULU_FAL_GR13_METADATA: CapsIsiZuluFALGr13Metadata = {
  documentId: CAPS_ISIZULU_FAL_GR13_DOC_ID,
  documentVersion: CAPS_ISIZULU_FAL_GR13_VERSION,
  title:
    'Curriculum and Assessment Policy Statement: IsiZulu First Additional Language, Grades 1-3',
  publisher: 'Department of Basic Education, Republic of South Africa',
  isbn: '978-1-4315-0419-0',
  status: 'RATIFIED',
  phase: 'FOUNDATION',
  grades: ['1', '2', '3'],
  subjectName: 'IsiZulu First Additional Language',
  ratifiedBy: null,
  pageCount: 98,
};
