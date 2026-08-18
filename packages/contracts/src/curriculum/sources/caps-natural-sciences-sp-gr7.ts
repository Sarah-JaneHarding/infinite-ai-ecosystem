// Derived structure from Natural Sciences Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_NS_SP_DOC_ID = 'caps-natural-sciences-sp-gr79-2011' as const;
export const CAPS_NS_SP_VERSION = '2011-ratified' as const;

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_NS_SP_DOC_ID,
    documentVersion: CAPS_NS_SP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_NS_SP_CONTENT_AREAS = [
  'Matter and Materials',
  'Energy and Change',
  'Planet Earth and Beyond',
  'Life and Living',
] as const;
export type CapsnsspContentArea = (typeof CAPS_NS_SP_CONTENT_AREAS)[number];

export interface CapsnsspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_NS_SP_TOPIC_PROGRESSIONS: readonly CapsnsspTopicProgression[] = [
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Properties of materials',
    grade: '7',
    description:
      'Investigating and classifying materials according to their properties (metals, non-metals, hardness, density, solubility); everyday examples and uses.',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Matter and Materials',
    topicCode: null,
    topicName: 'Mixtures and separating mixtures',
    grade: '7',
    description:
      'Composition of mixtures (solutions, suspensions); methods of separating mixtures (filtration, evaporation, distillation, sieving, using a magnet, sedimentation and decanting).',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy systems, transfers and forms',
    grade: '7',
    description:
      'Potential and kinetic energy; energy transfer and transformation; heating as a transfer of energy; forms of energy in everyday systems.',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Energy and Change',
    topicCode: null,
    topicName: 'Energy sources and saving energy',
    grade: '7',
    description:
      'National electricity supply and how electricity reaches homes; renewable and non-renewable energy sources; strategies for saving energy at home and school.',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Planet Earth and Beyond',
    topicCode: null,
    topicName: 'The Sun, Earth and solar system',
    grade: '7',
    description:
      "The Sun as a source of light and energy; structure of the solar system (planets, moons, other bodies); Planet Earth's place in the solar system.",
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Biosphere, ecosystems and biodiversity',
    grade: '7',
    description:
      'The biosphere as the sum of all ecosystems; habitats within an ecosystem; biodiversity among animals and plants and its importance.',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
  {
    contentArea: 'Life and Living',
    topicCode: null,
    topicName: 'Reproduction',
    grade: '7',
    description:
      'Sexual reproduction in flowering plants (structure of the flower, pollination, fertilisation, seed dispersal); sexual reproduction in humans; variation within human populations.',
    basis: ref('Senior Phase Concept and Content Progression table, Grade 7 column'),
  },
];

export const CAPS_NS_SP_METADATA = {
  documentId: CAPS_NS_SP_DOC_ID,
  documentVersion: CAPS_NS_SP_VERSION,
  title: 'Natural Sciences Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
