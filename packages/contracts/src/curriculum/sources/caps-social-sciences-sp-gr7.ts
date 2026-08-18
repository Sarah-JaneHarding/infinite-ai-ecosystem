// Derived structure from Social Sciences Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_SS_SP_DOC_ID = 'caps-social-sciences-sp-gr79-2011' as const;
export const CAPS_SS_SP_VERSION = '2011-ratified' as const;

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_SS_SP_DOC_ID,
    documentVersion: CAPS_SS_SP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_SS_SP_CONTENT_AREAS = ['History', 'Geography'] as const;
export type CapsssspContentArea = (typeof CAPS_SS_SP_CONTENT_AREAS)[number];

export interface CapsssspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_SS_SP_TOPIC_PROGRESSIONS: readonly CapsssspTopicProgression[] = [
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'The kingdom of Mali and the city of Timbuktu in the 14th century',
    grade: '7',
    description:
      'Trade, wealth and learning in the West African kingdom of Mali; the significance of Timbuktu as a centre of trade, Islamic scholarship and manuscripts.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Map skills',
    grade: '7',
    description:
      'Finding places of interest on a map and using a street map/atlas; scale, direction, grid references and map symbols.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Volcanoes, earthquakes and floods',
    grade: '7',
    description:
      'Causes of volcanoes, earthquakes and floods; case studies on why some communities are at higher risk than others from these natural hazards.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
  {
    contentArea: 'History',
    topicCode: null,
    topicName: 'Transatlantic slave trade and the transformation of Southern Africa',
    grade: '7',
    description:
      'Causes and impact of the transatlantic slave trade; changes in Southern African societies from the 1600s.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Population and settlement',
    grade: '7',
    description:
      'Population distribution and density; settlement patterns (rural and urban) and factors influencing where people live.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
];

export interface CapsssspSkill {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  term: number | null;
  description: string;
  basis: SourceRef;
}

export const CAPS_SS_SP_SKILLS: readonly CapsssspSkill[] = [
  {
    contentArea: 'Geography',
    topicCode: null,
    topicName: 'Geography project (Term 1)',
    grade: '7',
    term: 1,
    description:
      'Learners complete a Geography project in Grade 7 (with a strong focus on field observation and research in the local environment); the History project falls in a different grade in the phase cycle.',
    basis: ref('Section 3, Content Overview and Annual Teaching Plan tables, Grade 7'),
  },
];

export const CAPS_SS_SP_METADATA = {
  documentId: CAPS_SS_SP_DOC_ID,
  documentVersion: CAPS_SS_SP_VERSION,
  title: 'Social Sciences Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
