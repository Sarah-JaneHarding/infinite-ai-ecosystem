// Derived structure from Economic and Management Sciences Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_EMS_SP_DOC_ID = 'caps-ems-sp-gr79-2011' as const;
export const CAPS_EMS_SP_VERSION = '2011-ratified' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_EMS_SP_DOC_ID,
    documentVersion: CAPS_EMS_SP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_EMS_SP_CONTENT_AREAS = [
  'The Economy',
  'Financial Literacy',
  'Entrepreneurship',
] as const;
export type CapsemsspContentArea = (typeof CAPS_EMS_SP_CONTENT_AREAS)[number];

export interface CapsemsspWeighting {
  contentArea: string;
  grade: string;
  weightingPercent: number;
  basis: SourceRef;
}

export const CAPS_EMS_SP_WEIGHTINGS: readonly CapsemsspWeighting[] = [
  {
    contentArea: 'The Economy',
    grade: '7',
    weightingPercent: 30.0,
    basis: ref(
      'Section 2, Weighting of Curriculum and EMS Topics; Grade 7 Annual Teaching Plan',
    ),
  },
  {
    contentArea: 'Financial Literacy',
    grade: '7',
    weightingPercent: 50.0,
    basis: ref(
      'Section 2, Weighting of Curriculum and EMS Topics; Grade 7 Annual Teaching Plan',
    ),
  },
  {
    contentArea: 'Entrepreneurship',
    grade: '7',
    weightingPercent: 20.0,
    basis: ref(
      'Section 2, Weighting of Curriculum and EMS Topics; Grade 7 Annual Teaching Plan',
    ),
  },
];

export interface CapsemsspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_EMS_SP_TOPIC_PROGRESSIONS: readonly CapsemsspTopicProgression[] = [
  {
    contentArea: 'The Economy',
    topicCode: null,
    topicName: 'The production process (Term 4, Weeks 2-4)',
    grade: '7',
    description:
      'Definition of production; inputs and outputs; sustainable use of resources; meaning of economic growth and productivity; the effect of productivity on economic growth; the role of technology in the production process and its contribution to productivity and growth.',
    basis: ref('Grade 7 Term 4 Annual Teaching Plan table'),
  },
  {
    contentArea: 'Financial Literacy',
    topicCode: null,
    topicName: 'Savings (Term 4, Weeks 5-7)',
    grade: '7',
    description:
      'Personal savings and their purpose; history of banks and the role of banks; services offered by banks; opening a savings account; community savings schemes; financial institutions and organisations promoting entrepreneurship.',
    basis: ref('Grade 7 Term 4 Annual Teaching Plan table'),
  },
];

export const CAPS_EMS_SP_METADATA = {
  documentId: CAPS_EMS_SP_DOC_ID,
  documentVersion: CAPS_EMS_SP_VERSION,
  title: 'Economic and Management Sciences Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
