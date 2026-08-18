// Derived structure from Creative Arts Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_CA_SP_DOC_ID = 'caps-creative-arts-sp-gr79-2011' as const;
export const CAPS_CA_SP_VERSION = '2011-ratified' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_CA_SP_DOC_ID,
    documentVersion: CAPS_CA_SP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_CA_SP_CONTENT_AREAS = [
  'Programme Structure',
  'Visual Arts',
  'Music',
  'Drama',
  'Dance',
] as const;
export type CapscaspContentArea = (typeof CAPS_CA_SP_CONTENT_AREAS)[number];

export interface CapscaspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_CA_SP_TOPIC_PROGRESSIONS: readonly CapscaspTopicProgression[] = [
  {
    contentArea: 'Visual Arts',
    topicCode: null,
    topicName: 'Visual literacy and 2D/3D art-making',
    grade: '7',
    description:
      'Observing and discussing visual stimuli to build visual literacy; creating original 2D and 3D artworks exploring art elements (colour, texture, shape/form) and design principles (balance, proportion), building on Intermediate Phase Creative Arts skills.',
    basis: ref('Visual Arts Annual Teaching Plan overview'),
  },
  {
    contentArea: 'Music',
    topicCode: null,
    topicName: 'Warm-ups, improvisation and performance',
    grade: '7',
    description:
      'Vocal and physical warm-ups; improvising and creating simple melodies and rhythmic patterns; reading, interpreting and performing simple pieces; appreciating South African and other musical traditions.',
    basis: ref('Music Annual Teaching Plan overview'),
  },
  {
    contentArea: 'Drama',
    topicCode: null,
    topicName: 'Vocal and physical development; devised drama',
    grade: '7',
    description:
      'Vocal and physical development exercises; researching a theme and developing a short devised drama with a clear plot, credible characters and key moments; audience awareness.',
    basis: ref('Drama Annual Teaching Plan overview'),
  },
  {
    contentArea: 'Dance',
    topicCode: null,
    topicName: 'Dance conventions, warm-up and composition',
    grade: '7',
    description:
      'Dance conventions and safe practice; structured warm-up and cool-down; improvisation and composition varying space, direction, level and tempo in movement sequences.',
    basis: ref('Dance Annual Teaching Plan overview'),
  },
];

export interface CapscaspSkill {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  term: number | null;
  description: string;
  basis: SourceRef;
}

export const CAPS_CA_SP_SKILLS: readonly CapscaspSkill[] = [
  {
    contentArea: 'Programme Structure',
    topicCode: null,
    topicName: 'Two art forms studied across the year',
    grade: '7',
    term: null,
    description:
      'Creative Arts is allocated 2 hours per week in Grade 7, spread across all art forms initially and then focused; to allow depth of study and to prepare learners for FET arts subject choices, schools select TWO of the four art forms \u2014 Dance, Drama, Music, Visual Arts (including Design and Crafts) \u2014 for sustained study through Grade 7-9.',
    basis: ref('Section 2.3, Time Allocation of Creative Arts in the Curriculum'),
  },
];

export const CAPS_CA_SP_METADATA = {
  documentId: CAPS_CA_SP_DOC_ID,
  documentVersion: CAPS_CA_SP_VERSION,
  title: 'Creative Arts Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
