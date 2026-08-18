// Derived structure from Technology Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_TECH_SP_DOC_ID = 'caps-technology-sp-gr79-2011' as const;
export const CAPS_TECH_SP_VERSION = '2011-ratified' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_TECH_SP_DOC_ID,
    documentVersion: CAPS_TECH_SP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_TECH_SP_CONTENT_AREAS = [
  'Structures',
  'Processing',
  'Mechanical Systems and Control',
  'Electrical Systems and Control',
  'Technology, Society and the Environment',
] as const;
export type CapstechspContentArea = (typeof CAPS_TECH_SP_CONTENT_AREAS)[number];

export interface CapstechspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_TECH_SP_TOPIC_PROGRESSIONS: readonly CapstechspTopicProgression[] = [
  {
    contentArea: 'Structures',
    topicCode: null,
    topicName: 'Structures \u2014 stability, strength and reinforcement',
    grade: '7',
    description:
      'Investigating and analysing the stability, strength and stiffness of structures such as buildings; reinforcement techniques including triangulation, folding, tubing and internal support, applied through the Design Process (Investigate, Design, Make, Evaluate, Communicate).',
    basis: ref('Section 2.4, Topics and Core Content Areas in Technology'),
  },
  {
    contentArea: 'Processing',
    topicCode: null,
    topicName: 'Processing of materials',
    grade: '7',
    description:
      'Investigating properties and applications of materials (wood, metal, plastics, textiles, food); basic food-processing techniques (drying, heating, cooling, mixing, preservation); safety and hygiene when handling materials.',
    basis: ref('Section 2.4, Topics and Core Content Areas in Technology'),
  },
  {
    contentArea: 'Mechanical Systems and Control',
    topicCode: null,
    topicName: 'Levers, linkages, cranks and pulleys',
    grade: '7',
    description:
      'Investigating simple first-, second- and third-class levers and linkages found in everyday tools; introducing cranks (an adaptation of a second-class lever) and pulleys (a type of wheel and axle) and the concept of mechanical advantage.',
    basis: ref('Section 2.4, Topics and Core Content Areas in Technology'),
  },
  {
    contentArea: 'Electrical Systems and Control',
    topicCode: null,
    topicName: 'Simple electric circuits',
    grade: '7',
    description:
      'Investigating and constructing simple battery-powered electric circuits (max 9V DC in the GET band); components, symbols and switches; integrated mini-Practical Assessment Task combining structures, electricity and mechanisms.',
    basis: ref('Section 2.4, Topics and Core Content Areas in Technology'),
  },
  {
    contentArea: 'Technology, Society and the Environment',
    topicCode: null,
    topicName: 'Indigenous technology, impact and bias',
    grade: '7',
    description:
      'Cross-cutting theme addressed throughout the year: indigenous knowledge systems and technology; the impact of technology on society and the environment; recognising bias in technology and technological choices.',
    basis: ref('Section 2.4, Topics and Core Content Areas in Technology'),
  },
];

export const CAPS_TECH_SP_METADATA = {
  documentId: CAPS_TECH_SP_DOC_ID,
  documentVersion: CAPS_TECH_SP_VERSION,
  title: 'Technology Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
