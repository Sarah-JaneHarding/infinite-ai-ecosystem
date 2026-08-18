// Derived structure from Mathematics Foundation Phase Grades R-3.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_MATHS_FP_DOC_ID = 'caps-mathematics-fp-gr-r3-2011' as const;
export const CAPS_MATHS_FP_VERSION = '2011-ratified' as const;
export const CAPS_MATHS_FP_ISBN = '978-1-4315-0433-6' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_MATHS_FP_DOC_ID,
    documentVersion: CAPS_MATHS_FP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_MATHS_FP_CONTENT_AREAS = [
  'Numbers, Operations and Relationships',
  'Patterns, Functions and Algebra',
  'Space and Shape (Geometry)',
  'Measurement',
  'Data Handling',
] as const;
export type CapsmathsfpContentArea = (typeof CAPS_MATHS_FP_CONTENT_AREAS)[number];

export interface CapsmathsfpWeighting {
  contentArea: string;
  grade: string;
  weightingPercent: number;
  basis: SourceRef;
}

export const CAPS_MATHS_FP_WEIGHTINGS: readonly CapsmathsfpWeighting[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '1',
    weightingPercent: 65.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '1',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '1',
    weightingPercent: 11.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '1',
    weightingPercent: 9.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '1',
    weightingPercent: 5.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '2',
    weightingPercent: 60.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '2',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '2',
    weightingPercent: 13.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '2',
    weightingPercent: 12.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '2',
    weightingPercent: 5.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '3',
    weightingPercent: 58.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '3',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '3',
    weightingPercent: 13.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '3',
    weightingPercent: 14.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '3',
    weightingPercent: 5.0,
    basis: ref('Section 2.6, Table 2.2 - Weighting of Content Areas'),
  },
];

export interface CapsmathsfpTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_MATHS_FP_TOPIC_PROGRESSIONS: readonly CapsmathsfpTopicProgression[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: '1',
    description:
      'Estimate and reliably count at least 50 everyday objects, counting by grouping.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.3',
    topicName: 'Number symbols and names',
    grade: '1',
    description:
      'Recognise, identify, read and write number symbols 1-20 and number names 1-10.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7',
    topicName: 'Addition and subtraction',
    grade: '1',
    description:
      'Solve and explain word problems involving addition and subtraction with answers up to 20.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.17',
    topicName: 'Fractions',
    grade: '1',
    description:
      'Use and name unitary fractions (halves, quarters, thirds, fifths) in familiar contexts; recognise fractions in diagrammatic form.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: '1',
    description:
      'Recognise and name ball shapes (spheres) and box shapes (prisms) in the classroom and in pictures.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: '1',
    description:
      'Estimate, measure, compare, order and record length using non-standard measures (hand spans, paces, counters).',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.5',
    topicName: 'Represent data',
    grade: '1',
    description: 'Represent data in pictographs limited to one-to-one correspondence.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: '2',
    description:
      'Estimate and reliably count at least 200 everyday objects, counting by grouping.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7',
    topicName: 'Addition and subtraction',
    grade: '2',
    description:
      'Solve and explain word problems involving addition and subtraction with answers up to 99.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.8',
    topicName: 'Repeated addition/multiplication',
    grade: '2',
    description:
      'Solve word problems using repeated addition and multiplication with answers up to 50.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.17',
    topicName: 'Fractions',
    grade: '2',
    description:
      'Use and name unitary and non-unitary fractions including halves, quarters, eighths, thirds, sixths, fifths.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: '2',
    description:
      'Recognise and name spheres, prisms and cylinders in the classroom and pictures.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: '2',
    description:
      'Introduce formal measuring: estimate, measure, compare and record length in metres.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.5',
    topicName: 'Represent data',
    grade: '2',
    description: 'Represent data in pictographs and begin bar graphs.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: '3',
    description:
      'Estimate and reliably count at least 1000 everyday objects, counting by grouping.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7',
    topicName: 'Addition and subtraction',
    grade: '3',
    description:
      'Solve and explain word problems involving addition and subtraction with answers up to 999.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.9',
    topicName: 'Division',
    grade: '3',
    description:
      'Solve and explain practical problems involving equal sharing and grouping up to 100, with answers that may include remainders.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.15',
    topicName: 'Division (context-free)',
    grade: '3',
    description:
      'Divide numbers up to 100 by 2, 3, 4, 5 and 10 using appropriate symbols.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: '3',
    description:
      'Recognise and name spheres, prisms, cylinders, pyramids and cones; describe faces as flat or curved 2-D shapes.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.5',
    topicName: 'Perimeter and Area',
    grade: '3',
    description:
      'Investigate the distance around 2-D shapes/3-D objects (perimeter) and investigate area using tiling.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.4',
    topicName: 'Collect and organise data',
    grade: '3',
    description:
      'Organise data supplied by teacher/workbook into lists, tally marks and tables.',
    basis: ref('Section 3.2, Foundation Phase Overview (Grade-level progression tables)'),
  },
];

export interface CapsmathsfpSkill {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  term: number | null;
  description: string;
  basis: SourceRef;
}

export const CAPS_MATHS_FP_SKILLS: readonly CapsmathsfpSkill[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: 'R',
    term: 1,
    description:
      'Develop one-to-one correspondence and rote-count in the number range 1 to 5 using concrete apparatus, body parts, clapping and stepping.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: 'R',
    term: 2,
    description:
      'Extend one-to-one correspondence counting to the number range 1 to 7 using concrete apparatus and rhymes/songs.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: 'R',
    term: 3,
    description:
      'Extend counting to the number range 1 to 10; begin comparing quantities of claps as more/less, most/least.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.1',
    topicName: 'Count objects',
    grade: 'R',
    term: 4,
    description:
      'Consolidate counting across the number range 0 to 10 including zero, reinforced daily through routines.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.2',
    topicName: 'Count forwards and backwards',
    grade: 'R',
    term: 1,
    description:
      'Begin incidental counting in ones within number range 1, using rhymes, songs, counters and body movement.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.2',
    topicName: 'Count forwards and backwards',
    grade: 'R',
    term: 2,
    description:
      'Count in ones within the number range 1 to 4 through incidental, play-based activities.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.2',
    topicName: 'Count forwards and backwards',
    grade: 'R',
    term: 3,
    description:
      'Count in ones within the number range 1 to 7, introducing the physical number ladder.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.2',
    topicName: 'Count forwards and backwards',
    grade: 'R',
    term: 4,
    description:
      'Count in ones and begin counting in twos within the number range 0 to 10.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.3',
    topicName: 'Number symbols and number names',
    grade: 'R',
    term: 1,
    description:
      'Recognise and identify the number symbol and name for 1, using kinaesthetic, concrete and semi-concrete experiences.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.3',
    topicName: 'Number symbols and number names',
    grade: 'R',
    term: 2,
    description:
      'Recognise and identify number symbols and names for 2 to 4, reinforcing 1 to 4 overall.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.3',
    topicName: 'Number symbols and number names',
    grade: 'R',
    term: 3,
    description:
      'Recognise and identify number symbols and names for 5 to 7, reinforcing 1 to 7 overall.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.3',
    topicName: 'Number symbols and number names',
    grade: 'R',
    term: 4,
    description:
      'Recognise and identify number symbols and names for 0 and 8 to 10, consolidating 0 to 10 overall.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.4',
    topicName: 'Describe, compare and order numbers',
    grade: 'R',
    term: 1,
    description:
      'Use numbers in familiar contexts (own age, attendance register); identify numbers in pictures and dot cards; compare collections as big/small, bigger/smaller.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.4',
    topicName: 'Describe, compare and order numbers',
    grade: 'R',
    term: 2,
    description:
      'Use numbers in familiar contexts (house number, address); identify whole numbers up to 4; compare collections as more than/less than/equal to.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.4',
    topicName: 'Describe, compare and order numbers',
    grade: 'R',
    term: 3,
    description:
      'Use numbers in familiar contexts (telephone/cell number); identify whole numbers up to 7; introduce ordinal numbers (first to fourth/fifth).',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.4',
    topicName: 'Describe, compare and order numbers',
    grade: 'R',
    term: 4,
    description:
      'Reinforce numbers in familiar contexts; identify whole numbers 0 to 10; order collections from smallest to biggest; extend ordinal numbers to sixth.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.6',
    topicName: 'Problem-solving techniques',
    grade: 'R',
    term: 3,
    description:
      'Use concrete apparatus (counters) and the physical number ladder to solve problems.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.6',
    topicName: 'Problem-solving techniques',
    grade: 'R',
    term: 4,
    description:
      'Continue using concrete apparatus and the physical number ladder as core problem-solving techniques.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7 / 1.9',
    topicName: 'Addition, subtraction, grouping and sharing',
    grade: 'R',
    term: 2,
    description:
      'Orally solve word problems involving the numbers 2, 3 and 4 using counters.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7 / 1.9',
    topicName: 'Addition, subtraction, grouping and sharing',
    grade: 'R',
    term: 3,
    description:
      'Orally solve word problems involving the numbers 5, 6 and 7 using counters.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.7 / 1.9',
    topicName: 'Addition, subtraction, grouping and sharing',
    grade: 'R',
    term: 4,
    description:
      'Orally solve word problems involving the numbers 8, 9, 10 and 0 using counters.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.11',
    topicName: 'Money',
    grade: 'R',
    term: 1,
    description:
      'Develop awareness of South African coins (20c, 50c, R1, R2, R5) by colour, animal and sorting play money.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.11',
    topicName: 'Money',
    grade: 'R',
    term: 2,
    description:
      'Develop awareness of South African bank notes (R10-R200) by sorting play money in the home corner.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.11',
    topicName: 'Money',
    grade: 'R',
    term: 3,
    description:
      'Consolidate money awareness through continued play-money activities in the house corner.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.13',
    topicName: 'Addition and subtraction (oral)',
    grade: 'R',
    term: 2,
    description: 'Orally solve addition and subtraction problems with answers up to 4.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.13',
    topicName: 'Addition and subtraction (oral)',
    grade: 'R',
    term: 3,
    description: 'Orally solve addition and subtraction problems with answers up to 7.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: '1.13',
    topicName: 'Addition and subtraction (oral)',
    grade: 'R',
    term: 4,
    description: 'Orally solve addition and subtraction problems with answers up to 10.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: '2.1',
    topicName: 'Geometric patterns',
    grade: 'R',
    term: 1,
    description:
      'Identify patterns in clothes/objects/environment; copy and complete simple patterns; copy patterns using body percussion.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: '2.1',
    topicName: 'Geometric patterns',
    grade: 'R',
    term: 2,
    description:
      'Copy, complete and create own patterns using coins and other concrete objects.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: '2.1',
    topicName: 'Geometric patterns',
    grade: 'R',
    term: 3,
    description: 'Copy, extend and create own patterns with pictures.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: '2.1',
    topicName: 'Geometric patterns',
    grade: 'R',
    term: 4,
    description:
      'Copy, extend and create own auditory patterns (noise patterns, movement games such as hopscotch).',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.1',
    topicName: 'Position, orientation and views',
    grade: 'R',
    term: 1,
    description:
      'Describe the position of objects relative to self and others using in front/behind, on/under, in/out, up/down, next to/between.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.1',
    topicName: 'Position, orientation and views',
    grade: 'R',
    term: 2,
    description:
      'Extend positional vocabulary (next to, middle, left/right) and begin describing objects from different perspectives.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.1',
    topicName: 'Position, orientation and views',
    grade: 'R',
    term: 3,
    description:
      'Apply full range of positional vocabulary including top/bottom, left/right, between, in relation to one another.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.1',
    topicName: 'Position, orientation and views',
    grade: 'R',
    term: 4,
    description:
      'Apply directionality vocabulary (forwards/backwards, up/down, left/right) including auditory direction-following.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: 'R',
    term: 1,
    description:
      'Introduce and explore balls and boxes; sort by size, colour, shape, rolling/sliding properties.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: 'R',
    term: 2,
    description:
      'Sort 3-D objects/2-D shapes by size, colour (red/blue/yellow/green) and shape; build with construction materials.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: 'R',
    term: 3,
    description:
      'Continue sorting by size/colour/shape; copy a given construction from a design or picture card.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.2',
    topicName: '3-D objects',
    grade: 'R',
    term: 4,
    description:
      'Consolidate sorting and free-play construction with building blocks and materials.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.3',
    topicName: '2-D shapes',
    grade: 'R',
    term: 1,
    description:
      'Recognise own symbol/class name; begin puzzle-building (minimum 6-piece); introduce circle, triangle, square via figure-ground perception.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.3',
    topicName: '2-D shapes',
    grade: 'R',
    term: 2,
    description:
      'Build up to 12-piece puzzles; reinforce triangle; introduce shape conservation (form constancy).',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.3',
    topicName: '2-D shapes',
    grade: 'R',
    term: 3,
    description:
      'Build up to 18-piece puzzles; reinforce square; extend shape conservation across shapes learned to date.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.3',
    topicName: '2-D shapes',
    grade: 'R',
    term: 4,
    description:
      'Build up to 24-piece puzzles; reinforce circle, triangle, square and rectangle together with form constancy.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.4',
    topicName: 'Symmetry',
    grade: 'R',
    term: 1,
    description:
      'Identify body parts and develop early body-symmetry awareness through physical development activities.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.4',
    topicName: 'Symmetry',
    grade: 'R',
    term: 2,
    description:
      'Reinforce left/right body-side awareness and begin crossing-the-midline activities.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.4',
    topicName: 'Symmetry',
    grade: 'R',
    term: 3,
    description:
      'Apply crossing-the-midline through chalkboard and physical development activities.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: '3.4',
    topicName: 'Symmetry',
    grade: 'R',
    term: 4,
    description:
      'Develop awareness that symmetry exists in objects, reinforced through physical development.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.1',
    topicName: 'Time',
    grade: 'R',
    term: 1,
    description:
      'Introduce day/night and the Daily Programme chart; sequence recurring daily events.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.1',
    topicName: 'Time',
    grade: 'R',
    term: 2,
    description: 'Introduce the Weather Chart, days of the week and the Seasons Chart.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.1',
    topicName: 'Time',
    grade: 'R',
    term: 3,
    description:
      'Reinforce weather chart, days of the week and seasons chart; introduce Birthday Chart.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.1',
    topicName: 'Time',
    grade: 'R',
    term: 4,
    description:
      'Consolidate sequencing of recurring events, seasons and birthdays across the year.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: 'R',
    term: 1,
    description:
      'Introduce the Height Chart; compare length using hands, footprints and tape measure with vocabulary long/short, tall/taller/tallest.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: 'R',
    term: 2,
    description:
      'Reinforce length vocabulary (long/short, tall/taller/tallest) and re-measure height against classroom references.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: 'R',
    term: 3,
    description:
      'Estimate and measure the length of objects using feet, hands, string and sticks.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.2',
    topicName: 'Length',
    grade: 'R',
    term: 4,
    description:
      "Measure learners' height with a tape measure, replacing informal hand/foot measures.",
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.3',
    topicName: 'Mass',
    grade: 'R',
    term: 2,
    description: 'Introduce mass concept comparing light/heavy, lighter/heavier objects.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.3',
    topicName: 'Mass',
    grade: 'R',
    term: 4,
    description: 'Reinforce mass vocabulary including lightest/heaviest.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Measurement',
    topicCode: '4.4',
    topicName: 'Capacity/Volume',
    grade: 'R',
    term: 2,
    description:
      'Introduce capacity by comparing how much different containers hold, using empty/full, more than/less than.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.1',
    topicName: 'Collect and sort objects',
    grade: 'R',
    term: 1,
    description:
      'Introduce data handling by collecting simple class data (e.g. number of boys/girls) and objects of varying size.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.1',
    topicName: 'Collect and sort objects',
    grade: 'R',
    term: 2,
    description:
      'Pose and answer a simple data question (e.g. name-length popularity) using name cards.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.1',
    topicName: 'Collect and sort objects',
    grade: 'R',
    term: 3,
    description:
      'Use the Birthday Chart to determine which months have the most birthdays.',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: '5.1',
    topicName: 'Collect and sort objects',
    grade: 'R',
    term: 4,
    description:
      'Collect data to answer a posed question (e.g. mode of transport used to get to school).',
    basis: ref('Section 3.4, Grade R Overview per Term'),
  },
];

export const CAPS_MATHS_FP_METADATA = {
  documentId: CAPS_MATHS_FP_DOC_ID,
  documentVersion: CAPS_MATHS_FP_VERSION,
  title: 'Mathematics Foundation Phase Grades R-3',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0433-6',
  phase: 'Foundation Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
