// Derived structure from Mathematics Senior Phase Grade 7.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 1 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_MATHS_SP_DOC_ID = 'caps-mathematics-sp-gr79-2011' as const;
export const CAPS_MATHS_SP_VERSION = '2011-ratified' as const;
export const CAPS_MATHS_SP_ISBN = '978-1-4315-0525-8' as const;

function ref(clause: string): SourceRef {
  return {
    documentId: CAPS_MATHS_SP_DOC_ID,
    documentVersion: CAPS_MATHS_SP_VERSION,
    clause,
    ratifiedBy: null,
  };
}

export const CAPS_MATHS_SP_CONTENT_AREAS = [
  'Numbers, Operations and Relationships',
  'Patterns, Functions and Algebra',
  'Space and Shape (Geometry)',
  'Measurement',
  'Data Handling',
] as const;
export type CapsmathsspContentArea = (typeof CAPS_MATHS_SP_CONTENT_AREAS)[number];

export interface CapsmathsspWeighting {
  contentArea: string;
  grade: string;
  weightingPercent: number;
  basis: SourceRef;
}

export const CAPS_MATHS_SP_WEIGHTINGS: readonly CapsmathsspWeighting[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '7',
    weightingPercent: 30.0,
    basis: ref(
      'Section 2.3.2, Weighting of Content Areas and Topics (Senior Phase table, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '7',
    weightingPercent: 25.0,
    basis: ref(
      'Section 2.3.2, Weighting of Content Areas and Topics (Senior Phase table, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '7',
    weightingPercent: 25.0,
    basis: ref(
      'Section 2.3.2, Weighting of Content Areas and Topics (Senior Phase table, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Measurement',
    grade: '7',
    weightingPercent: 10.0,
    basis: ref(
      'Section 2.3.2, Weighting of Content Areas and Topics (Senior Phase table, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Data Handling',
    grade: '7',
    weightingPercent: 10.0,
    basis: ref(
      'Section 2.3.2, Weighting of Content Areas and Topics (Senior Phase table, Grade 7 column)',
    ),
  },
];

export interface CapsmathsspTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_MATHS_SP_TOPIC_PROGRESSIONS: readonly CapsmathsspTopicProgression[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers',
    grade: '7',
    description:
      'Properties of whole numbers; calculations using whole numbers (all four operations, including negative results where relevant); ratio, rate and financial mathematics contexts (profit, loss, discount, VAT, budgets, exchange rates, simple interest); multiples, factors and prime factorisation.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Exponents',
    grade: '7',
    description:
      'Mental and written calculation of squares, cubes, square roots and cube roots of numbers to at least the equivalent of 12x12; exponential notation (base and exponent); laws of exponents applied to simple cases.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Integers',
    grade: '7',
    description:
      'Ordering and comparing integers; calculations with integers (addition, subtraction, multiplication, division) using number lines and other strategies; solving problems in real-life contexts involving integers.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common and decimal fractions',
    grade: '7',
    description:
      'Ordering, comparing and simplifying common fractions and mixed numbers; addition, subtraction, multiplication and division of common fractions; calculations with decimal fractions; percentages and equivalence between common fraction, decimal fraction and percentage forms.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Numeric and geometric patterns',
    grade: '7',
    description:
      'Investigate and extend numeric and geometric patterns looking for relationships/rules in terms of position and general algebraic rules; represent and analyse patterns using physical objects, tables and expressions.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Functions and relationships',
    grade: '7',
    description:
      'Determine input and output values using flow diagrams, tables, ordered pairs and equations; describe verbally the relationship between input and output values of a flow diagram.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Algebraic expressions',
    grade: '7',
    description:
      'Recognise, interpret, classify and write algebraic expressions with integer exponents; add and subtract like terms; multiply integers and monomials by monomials/binomials.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Algebraic equations',
    grade: '7',
    description:
      'Set up equations to describe problem situations; solve equations by inspection, trial-and-improvement, and additive/multiplicative inverses; check solutions by substitution.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Graphs',
    grade: '7',
    description:
      'Extract information from graphs representing a given/simulated situation (e.g. filling a bath) and draw graphs from given descriptions of a problem situation.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Geometry of straight lines',
    grade: '7',
    description:
      'Identify, name, compare and describe pairs of angles as complementary, supplementary, adjacent or vertically opposite; relationships between angles formed by intersecting lines and parallel lines cut by a transversal.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Construction of geometric figures',
    grade: '7',
    description:
      'Use compasses, rulers and protractors to draw and construct geometric figures for investigation and problem solving; bisecting lines and angles.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Geometry of 2D shapes',
    grade: '7',
    description:
      'Classify and describe triangles and quadrilaterals in terms of properties of sides, angles and diagonals; identify and describe properties of congruent and similar shapes.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Geometry of 3D objects',
    grade: '7',
    description:
      'Classify and describe 3D objects in terms of number and shape of faces, number of vertices and edges; identify and describe nets of prisms, pyramids and other polyhedra; build 3D models.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Transformations, symmetry and the Cartesian plane',
    grade: '7',
    description:
      'Recognise, describe and perform transformations (translations, reflections, rotations) with geometric figures on the Cartesian plane; identify and draw lines of symmetry in 2D shapes; plot points using ordered pairs of coordinates.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Perimeter, area and volume',
    grade: '7',
    description:
      'Use appropriate formulae and conversions between SI units to solve problems involving perimeter and area of polygons and circles, and surface area/volume of prisms and cylinders.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Time',
    grade: '7',
    description:
      'Calculations involving time, including problems with 12-hour and 24-hour clocks; reading and interpreting timetables, converting between units of time.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Collect, organise, summarise and analyse data',
    grade: '7',
    description:
      'Pose questions, collect and organise data (including own surveys) using tallies and tables; summarise data using measures of central tendency (mean, median, mode) and range; represent data using bar graphs, double bar graphs, histograms and pie charts.',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Interpret, analyse and report data; probability',
    grade: '7',
    description:
      'Critically read, interpret and report on data represented in graphs and tables; introduce probability concepts through simple experiments (relative frequency, expressing probability as a fraction between 0 and 1).',
    basis: ref(
      'Section 2.3.3, Overview of Content Topics (Senior Phase progression map, Grade 7 column)',
    ),
  },
];

export const CAPS_MATHS_SP_METADATA = {
  documentId: CAPS_MATHS_SP_DOC_ID,
  documentVersion: CAPS_MATHS_SP_VERSION,
  title: 'Mathematics Senior Phase Grade 7',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0525-8',
  phase: 'Senior Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
