// Derived structure from Home Language Senior Phase Grade 7 (generic across official languages).
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_HL_SP_DOC_ID = 'caps-hl-sp-gr79-2011' as const;
export const CAPS_HL_SP_VERSION = '2011-ratified' as const;

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_HL_SP_DOC_ID,
    documentVersion: CAPS_HL_SP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_HL_SP_CONTENT_AREAS = [
  'Listening and Speaking',
  'Reading and Viewing',
  'Writing and Presenting',
  'Language Structures and Conventions',
] as const;
export type CapshlspContentArea = (typeof CAPS_HL_SP_CONTENT_AREAS)[number];

export interface CapshlspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_HL_SP_TOPIC_PROGRESSIONS: readonly CapshlspTopicProgression[] = [
  {
    contentArea: 'Listening and Speaking',
    topicCode: null,
    topicName: 'Listening and Speaking',
    grade: '7',
    description:
      'Listening for information, appreciation and critical evaluation of a range of texts (discussions, interviews, oral reports); prepared and unprepared speaking, including formal talks, debates and dialogues, with attention to register and non-verbal cues.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase',
    ),
  },
  {
    contentArea: 'Reading and Viewing',
    topicCode: null,
    topicName: 'Reading and Viewing',
    grade: '7',
    description:
      'Reading and viewing a wide range of literary and non-literary texts (novels, short stories, poetry, drama, magazine/newspaper articles, visual and multimodal texts) for comprehension, analysis, interpretation and enjoyment; developing reading strategies and vocabulary.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase',
    ),
  },
  {
    contentArea: 'Writing and Presenting',
    topicCode: null,
    topicName: 'Writing and Presenting',
    grade: '7',
    description:
      'Producing a range of transactional, creative and informational texts (essays, letters, reports, dialogues, summaries) through a structured writing process (planning, drafting, revising, editing, presenting); developing paragraph and text structure.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase',
    ),
  },
  {
    contentArea: 'Language Structures and Conventions',
    topicCode: null,
    topicName: 'Language Structures and Conventions',
    grade: '7',
    description:
      'Grammar, sentence structure, punctuation, spelling and vocabulary development taught in the context of listening/speaking, reading/viewing and writing/presenting activities across the year, rather than in isolation.',
    basis: ref(
      'Section 3, Content and Skills \u2014 Language Skill Areas overview, Senior Phase',
    ),
  },
];

export const CAPS_HL_SP_METADATA = {
  documentId: CAPS_HL_SP_DOC_ID,
  documentVersion: CAPS_HL_SP_VERSION,
  title: 'Home Language Senior Phase Grade 7 (generic across official languages)',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
