// Derived structure from First Additional Language Senior Phase Grade 7 (generic across official languages).
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_FAL_SP_DOC_ID = 'caps-fal-sp-gr79-2011' as const;
export const CAPS_FAL_SP_VERSION = '2011-ratified' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_FAL_SP_DOC_ID,
    documentVersion: CAPS_FAL_SP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_FAL_SP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Reading and Viewing',
  'Writing and Presenting',
  'Language Structures and Conventions',
] as const;
export type CapsfalspContentArea = (typeof CAPS_FAL_SP_CONTENT_AREAS)[number];

export interface CapsfalspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_FAL_SP_TOPIC_PROGRESSIONS: readonly CapsfalspTopicProgression[] = [
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Listening and Speaking',
    grade: '7',
    description:
      'Developing listening comprehension of a second language through a range of spoken texts; guided and increasingly independent speaking activities (conversations, short talks, discussions) with a focus on building confidence and fluency in the additional language.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase FAL',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Reading and Viewing',
    grade: '7',
    description:
      'Reading a range of graded literary and factual texts appropriate to FAL proficiency level; developing decoding, comprehension and vocabulary-building strategies; viewing and interpreting visual/multimodal texts.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase FAL',
    ),
  },
  {
    contentArea: 'Writing and Presenting',
    topicCode: null,
    topicName: 'Writing and Presenting',
    grade: '7',
    description:
      'Guided and gradually more independent writing of short transactional and creative texts (paragraphs, friendly letters, messages, simple narratives) using a supported writing process appropriate to FAL level.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase FAL',
    ),
  },
  {
    contentArea: 'Language Structures and Conventions',
    topicCode: null,
    topicName: 'Language Structures and Conventions',
    grade: '7',
    description:
      'Core grammar, sentence patterns, punctuation and high-frequency vocabulary taught explicitly and reinforced in context, at a pace appropriate for additional-language learners.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase FAL',
    ),
  },
];

export const CAPS_FAL_SP_METADATA = {
  documentId: CAPS_FAL_SP_DOC_ID,
  documentVersion: CAPS_FAL_SP_VERSION,
  title:
    'First Additional Language Senior Phase Grade 7 (generic across official languages)',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
