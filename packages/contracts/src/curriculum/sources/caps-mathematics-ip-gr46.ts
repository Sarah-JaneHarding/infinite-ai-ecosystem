// Derived structure from Mathematics Intermediate Phase Grades 4-6.
// Publisher: Department of Basic Education (DBE), South Africa.
// Source documents ingested: 3 document(s).
// Generated from structured export: ratifiedBy is null until a human countersigns.
// Stored: derived topic/content identifiers and weightings only — no source text.

import type { SourceRef } from '../framework.js';

export const CAPS_MATHS_IP_DOC_ID = 'caps-mathematics-ip-gr46-2011' as const;
export const CAPS_MATHS_IP_VERSION = '2011-ratified' as const;
export const CAPS_MATHS_IP_ISBN = '978-1-4315-0491-6' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: CAPS_MATHS_IP_DOC_ID,
    documentVersion: CAPS_MATHS_IP_VERSION,
    clause,
    ...(page !== undefined ? { page } : {}),
    ratifiedBy: null,
  };
}

export const CAPS_MATHS_IP_CONTENT_AREAS = [
  'Numbers, Operations and Relationships',
  'Patterns, Functions and Algebra',
  'Space and Shape (Geometry)',
  'Measurement',
  'Data Handling',
] as const;
export type CapsmathsipContentArea = (typeof CAPS_MATHS_IP_CONTENT_AREAS)[number];

export interface CapsmathsipWeighting {
  contentArea: string;
  grade: string;
  weightingPercent: number;
  basis: SourceRef;
}

export const CAPS_MATHS_IP_WEIGHTINGS: readonly CapsmathsipWeighting[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '4',
    weightingPercent: 50.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '4',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '4',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '4',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '4',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '5',
    weightingPercent: 50.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '5',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '5',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '5',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '5',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    grade: '6',
    weightingPercent: 50.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    grade: '6',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    grade: '6',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Measurement',
    grade: '6',
    weightingPercent: 15.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
  {
    contentArea: 'Data Handling',
    grade: '6',
    weightingPercent: 10.0,
    basis: ref('Section 2.6, Table: Weighting of Content Areas'),
  },
];

export interface CapsmathsipTopicProgression {
  contentArea: string;
  topicCode: string | null;
  topicName: string | null;
  grade: string;
  description: string;
  basis: SourceRef;
}

export const CAPS_MATHS_IP_TOPIC_PROGRESSIONS: readonly CapsmathsipTopicProgression[] = [
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.1 Whole numbers',
    grade: '4',
    description:
      'Mental calculations: addition/subtraction of units, multiples of 10/100/1000; multiplication of whole numbers to at least 10\u00d710; multiplication facts of units by multiples of 10/100. Counting, ordering, comparing, representing (up to 4-digit numbers): count forwards/backwards in 2s, 3s, 5s, 10s, 25s, 50s, 100s between 0 and at least 10 000; order/compare/represent numbers to at least 4-digit numbers; represent odd/even numbers to at least 1 000; recognise place value to 4 digits; round off to nearest 10, 100, 1 000. Calculations: addition/subtraction of whole numbers of at least 4 digits; multiplication of at least 2-digit by 2-digit numbers; division of at least 3-digit by 1-digit numbers. Techniques: estimation, building up/breaking down, rounding off/compensating, doubling/halving, number line, inverse operations. Multiples: multiples of 1-digit numbers to at least 100. Properties: commutative, associative, distributive. Solving problems: financial and measurement contexts; ratio; rate; grouping and equal sharing with remainders.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.1 Whole numbers',
    grade: '5',
    description:
      'Mental calculations: addition/subtraction of units, multiples of 10/100/1000; multiplication to at least 10\u00d710; multiplication facts of units by multiples of 10/100/1000/10000. Counting/ordering/comparing/representing (up to 6-digit numbers): count in whole number intervals up to at least 10 000; order/compare/represent to at least 6-digit numbers; odd/even to 1 000; place value to 6 digits; round off to nearest 5/10/100/1000. Calculations: addition/subtraction of at least 5-digit numbers; multiplication of at least 3-digit by 2-digit numbers; division of at least 3-digit by 2-digit numbers. Techniques: estimation; adding/subtracting in columns; building up/breaking down; number line; rounding/compensating; doubling/halving; inverse operations. Multiples/factors: multiples/factors of 2-digit whole numbers to at least 100. Properties: commutative, associative, distributive; additive property of 0; multiplicative property of 1. Solving problems: financial/measurement contexts; ratio; rate; grouping and equal sharing with remainders.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.1 Whole numbers',
    grade: '6',
    description:
      'Mental calculations: addition/subtraction of units, multiples of 10/100/1000; multiplication to at least 12\u00d712; multiplication facts of units/tens by multiples of 10/100/1000/10000. Ordering/comparing/representing (up to 9-digit numbers): order/compare/represent to at least 9-digit numbers; prime numbers to at least 100; place value to 9 digits; round off to nearest 5/10/100/1000/100000/1000000. Calculations: addition/subtraction of at least 6-digit numbers; multiplication of at least 4-digit by 3-digit; division of at least 4-digit by 3-digit; multiple operations on whole numbers with/without brackets. Techniques: estimation; adding/subtracting/multiplying in columns; long division; building up/breaking down; rounding/compensating; inverse operations; using a calculator. Multiples/factors/primes: multiples/factors of 2-digit and 3-digit numbers; prime factors of numbers to at least 100. Properties: commutative, associative, distributive; additive property of 0; multiplicative property of 1. Solving problems: financial/measurement contexts involving whole numbers and decimal fractions; ratio; rate; grouping and equal sharing with remainders.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.2 Common Fractions',
    grade: '4',
    description:
      'Describe and order fractions: compare and order common fractions with different denominators (halves, thirds, quarters, fifths, sixths, sevenths, eighths); describe and compare common fractions in diagram form. Calculations: addition of common fractions with the same denominators; recognise, describe and use the equivalence of division and fractions. Solving problems: solve problems in contexts involving fractions including grouping and equal sharing. Equivalent forms: recognise and use equivalent forms of common fractions (one denominator is a multiple of another).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.2 Common Fractions',
    grade: '5',
    description:
      'Equivalent forms: recognise and use equivalent forms of common fractions (one denominator is a multiple of another). Describe and order fractions: count forwards/backwards in fractions; compare and order common fractions to at least twelfths. Calculations: addition and subtraction of common fractions with same denominators; addition and subtraction of mixed numbers; fractions of whole numbers resulting in whole numbers; recognise the equivalence of division and fractions. Solving problems: solve problems in contexts involving common fractions including grouping and sharing.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.2 Common Fractions',
    grade: '6',
    description:
      'Describe and order fractions: compare and order common fractions including tenths and hundredths. Calculations: addition and subtraction of common fractions in which one denominator is a multiple of another; addition and subtraction of mixed numbers; fractions of whole numbers. Percentages: find percentages of whole numbers. Equivalent forms: recognise and use equivalent forms with 1- or 2-digit denominators; recognise equivalence between common fraction and decimal fraction forms; recognise equivalence between common fraction, decimal fraction and percentage forms of the same number. Solving problems: solve problems in contexts involving common fractions including grouping and sharing.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: '1.3 Decimal Fractions',
    grade: '4',
    description:
      'Recognising, ordering and place value: count forwards/backwards in decimal fractions to at least two decimal places; compare and order decimal fractions to at least two decimal places; place value of digits to at least two decimal places. Calculations: addition and subtraction of decimal fractions with at least two decimal places; multiply decimal fractions by 10 and 100. Solving problems: solve problems in context involving decimal fractions. Equivalent forms: recognise equivalence between common fraction and decimal fraction forms; recognise equivalence between common fraction, decimal fraction and percentage forms of the same number.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.1 Numeric patterns',
    grade: '4',
    description:
      "Investigate and extend numeric patterns looking for relationships or rules: sequences involving a constant difference or ratio; of learner's own creation; describe observed relationships or rules in own words. Input and output values: determine input values, output values and rules for patterns using flow diagrams and tables. Equivalent forms: determine equivalence of different descriptions of the same relationship or rule presented verbally, in a flow diagram, in a table, and by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.1 Numeric patterns',
    grade: '5',
    description:
      "Investigate and extend numeric patterns looking for relationships or rules: sequences not limited to a constant difference or ratio; of learner's own creation; describe observed relationships or rules in own words. Input and output values: determine input values, output values and rules using flow diagrams and tables. Equivalent forms: determine equivalence of different descriptions presented verbally, in a flow diagram, in a table, and by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.1 Numeric patterns',
    grade: '6',
    description:
      "Investigate and extend numeric patterns: sequences not limited to a constant difference or ratio; of learner's own creation; represented in tables; describe the general rules for observed relationships. Input and output values: determine input values, output values and rules using flow diagrams and tables. Equivalent forms: determine equivalence of different descriptions presented verbally, in a flow diagram, in a table, and by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.2 Geometric patterns',
    grade: '4',
    description:
      "Investigate and extend geometric patterns: in physical or diagram form; sequences not limited to a constant difference or ratio; of learner's own creation; describe observed relationships or rules in own words. Input and output values: determine input values, output values and rules using flow diagrams. Equivalent forms: determine equivalence of different descriptions presented verbally, in a flow diagram, or by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.2 Geometric patterns',
    grade: '5',
    description:
      "Investigate and extend geometric patterns: in physical or diagram form; sequences not limited to a constant difference or ratio; of learner's own creation; describe observed relationships or rules in own words. Input and output values: using flow diagrams. Equivalent forms: verbally, in a flow diagram, or by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.2 Geometric patterns',
    grade: '6',
    description:
      "Investigate and extend geometric patterns: in physical or diagram form; sequences not limited to a constant difference or ratio; of learner's own creation; represented in tables; describe the general rules for observed relationships. Input and output values: using flow diagrams and tables. Equivalent forms: verbally, in a flow diagram, in a table, or by a number sentence.",
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.3 Number sentences (introduction to algebraic expressions)',
    grade: '4',
    description:
      'Write number sentences to describe problem situations. Solve and complete number sentences by inspection, trial and improvement, or substitution. Check solution by substitution.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.3 Number sentences (introduction to algebraic expressions)',
    grade: '5',
    description:
      'Write number sentences to describe problem situations. Solve and complete number sentences by inspection, trial and improvement, or substitution. Check solution by substitution.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: '2.3 Number sentences (introduction to algebraic expressions)',
    grade: '6',
    description:
      'Write number sentences to describe problem situations. Solve and complete number sentences by inspection, trial and improvement, or substitution. Check solution by substitution.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.1 Properties of 2-D shapes',
    grade: '4',
    description:
      'Range: recognise, visualise and name 2-D shapes \u2014 regular and irregular polygons: triangles, squares, rectangles, other quadrilaterals, pentagons, hexagons; and circles. Characteristics: describe, sort and compare shapes in terms of straight/curved sides and number of sides. Angles: recognise right angles, angles smaller than right angles, angles greater than right angles. Further activities: draw 2-D shapes on grid paper.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.1 Properties of 2-D shapes',
    grade: '5',
    description:
      'Range: recognise, visualise and name 2-D shapes \u2014 regular and irregular polygons: triangles, squares, rectangles, other quadrilaterals, pentagons, hexagons, heptagons; circles; similarities and differences between squares and rectangles. Characteristics: describe, sort and compare shapes in terms of straight/curved sides, number of sides, lengths of sides, and angles (right, smaller than right, greater than right). Angles: recognise and name acute, right, obtuse, straight, reflex and revolution angles. Further activities: draw 2-D shapes on grid paper.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.1 Properties of 2-D shapes',
    grade: '6',
    description:
      'Range: recognise, visualise and name 2-D shapes \u2014 regular and irregular polygons: triangles, squares, rectangles, parallelograms, other quadrilaterals, pentagons, hexagons, heptagons, octagons; circles; similarities and differences between rectangles and parallelograms. Characteristics: describe, sort and compare shapes in terms of number of sides, lengths of sides and sizes of angles (acute, right, obtuse, straight, reflex, revolution). Further activities: draw 2-D shapes on grid paper; draw circles, patterns in circles and patterns with circles using a pair of compasses.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.2 Properties of 3-D objects',
    grade: '4',
    description:
      'Range: recognise, visualise and name 3-D objects \u2014 rectangular prisms, spheres, cylinders, pyramids. Characteristics: describe, sort and compare in terms of shapes of faces and flat/curved surfaces. Further activities: make 3-D models using cut-out polygons.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.2 Properties of 3-D objects',
    grade: '5',
    description:
      'Range: recognise, visualise and name 3-D objects \u2014 rectangular prisms and other prisms, cubes, cylinders, cones, pyramids; similarities and differences between cubes and rectangular prisms. Characteristics: describe, sort and compare in terms of shape of faces, number of faces, and flat/curved surfaces. Further activities: make 3-D models using cut-out polygons; cut open boxes to trace and describe nets.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.2 Properties of 3-D objects',
    grade: '6',
    description:
      'Range: recognise, visualise and name 3-D objects \u2014 rectangular prisms, cubes, tetrahedrons, pyramids; similarities and differences between tetrahedrons and other pyramids. Characteristics: describe, sort and compare in terms of number and shape of faces, number of vertices, number of edges. Further activities: make 3-D models using drinking straws/toothpicks; and nets.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.3 Symmetry',
    grade: '4',
    description: 'Recognise, draw and describe line(s) of symmetry in 2-D shapes.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.3 Symmetry',
    grade: '5',
    description: 'Recognise, draw and describe line(s) of symmetry in 2-D shapes.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.3 Symmetry',
    grade: '6',
    description: 'Recognise, draw and describe line(s) of symmetry in 2-D shapes.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.4 Transformations',
    grade: '4',
    description:
      'Build composite shapes: put 2-D shapes together to make different composite 2-D shapes including some with line symmetry. Tessellations: pack out 2-D shapes to make tessellated patterns including some with line symmetry. Describe patterns: refer to lines, 2-D shapes, 3-D objects and lines of symmetry when describing patterns in nature, modern everyday life and our cultural heritage.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.4 Transformations',
    grade: '5',
    description:
      'Use transformations to make composite shapes: by rotation, translation and reflection \u2014 make composite 2-D shapes with line symmetry by tracing and moving a 2-D shape. Use transformations to make tessellations: by rotation, translation and reflection. Describe patterns: refer to lines, 2-D shapes, 3-D objects, lines of symmetry, rotations, reflections and translations when describing patterns in nature, modern everyday life and from our cultural heritage.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.4 Transformations',
    grade: '6',
    description:
      'Enlargements and reductions: draw enlargements and reductions of 2-D shapes to compare size and shape of triangles and quadrilaterals. Describe patterns: refer to lines, 2-D shapes, 3-D objects, lines of symmetry, rotations, reflections and translations when describing patterns in nature, modern everyday life and from our cultural heritage.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.5 Viewing of objects',
    grade: '4',
    description:
      'Position and views: match different views of everyday objects; identify everyday objects from different views.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.5 Viewing of objects',
    grade: '5',
    description:
      'Position and views: link the position of viewer to views of single everyday objects and collections of everyday objects or everyday scenes.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.5 Viewing of objects',
    grade: '6',
    description:
      'Position and views: link the position of viewer to views of single everyday objects or collections of objects, and single or composite geometric objects.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.6 Position and movement',
    grade: '4',
    description:
      'Location and directions: locate position of objects, drawings or symbols on a grid with alpha-numeric grid references; locate positions of objects on a map by using alpha-numeric grid references.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.6 Position and movement',
    grade: '5',
    description:
      'Location and directions: locate position of objects on a grid and on a map using alpha-numeric grid references; follow directions to trace a path between positions on a map.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: '3.6 Position and movement',
    grade: '6',
    description:
      'Location and directions: locate position of objects on a grid and on a map using alpha-numeric grid references; give directions to move between positions or places on a map.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.1 Length',
    grade: '4',
    description:
      'Practical measuring of 2-D shapes and 3-D objects: estimate, measure, record, compare and order. Instruments: rulers, metre sticks, tape measures, trundle wheels. Units: mm, cm, m, km. Calculations/problem-solving: solve problems involving length; convert between mm\u2194cm, cm\u2194m, m\u2194km (whole numbers and common fractions only).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.1 Length',
    grade: '5',
    description:
      'Practical measuring of 2-D shapes and 3-D objects: estimate, measure, record, compare and order. Instruments: rulers, metre sticks, tape measures, trundle wheels. Units: mm, cm, m, km. Calculations/problem-solving: solve problems involving length; convert between any of mm, cm, m, km (whole numbers and common fractions).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.1 Length',
    grade: '6',
    description:
      'Practical measuring of 2-D shapes and 3-D objects: estimate, measure, record, compare and order. Instruments: rulers, metre sticks, tape measures, trundle wheels. Units: mm, cm, m, km. Calculations/problem-solving: solve problems involving length; convert between any of mm, cm, m, km (including common fractions and decimal fractions to 2 decimal places).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.2 Mass',
    grade: '4',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: bathroom scales, kitchen scales and balances. Units: g and kg. Calculations/problem-solving: solve problems in context; convert between g and kg limited to whole numbers and fractions.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.2 Mass',
    grade: '5',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: bathroom scales, kitchen scales and balances. Units: g and kg. Calculations/problem-solving: solve problems in context; convert between g and kg limited to whole numbers and fractions.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.2 Mass',
    grade: '6',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: analogue and digital bathroom/kitchen scales and balances. Units: g and kg. Calculations/problem-solving: solve problems in context; convert between g and kg including fraction and decimal forms to 2 decimal places.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.3 Capacity/Volume',
    grade: '4',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: measuring spoons, measuring cups, measuring jugs. Units: ml and l. Calculations/problem-solving: solve problems in context; convert between l and ml limited to whole numbers and fractions.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.3 Capacity/Volume',
    grade: '5',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: measuring spoons, measuring cups, measuring jugs. Units: ml and l. Calculations/problem-solving: solve problems in context; convert between l and ml limited to whole numbers and fractions.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.3 Capacity/Volume',
    grade: '6',
    description:
      'Practical measuring: estimate, measure, record, compare and order. Instruments: measuring jugs. Units: ml, l and kl. Calculations/problem-solving: solve problems in context; convert between kl, l and ml including fraction and decimal forms to 2 decimal places.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.4 Time',
    grade: '4',
    description:
      'Read, tell and write time in 12-hour and 24-hour formats on analogue and digital instruments in hours, minutes and seconds (clocks and watches). Read calendars. Calculations/problem-solving: calculate the number of days between any two dates within the same or consecutive years; calculate time intervals where time is given in minutes or hours only. History of time: know some ways time was measured and represented in ancient times.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.4 Time',
    grade: '5',
    description:
      'Read, tell and write time in 12-hour and 24-hour formats on analogue and digital instruments (including stopwatches). Read calendars. Calculations/problem-solving: calculate time intervals in seconds and/or minutes; minutes and/or hours; hours and/or days; days, weeks and/or months; years and/or decades. History of time: know some ways time was measured and represented in the past.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.4 Time',
    grade: '6',
    description:
      'Read, tell and write time in 12-hour and 24-hour formats on analogue and digital instruments (including stopwatches). Read calendars and time zone maps; calculate time differences based on time zones. Calculations/problem-solving: calculate time intervals in seconds/minutes; minutes/hours; hours/days; days/weeks/months; years/decades; centuries/decades/years. History of time: know some ways time was measured and represented in the past.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.5 Temperature',
    grade: '4',
    description:
      'Practical measuring: estimate, measure, record, compare and order temperature. Instruments: thermometers. Units: degrees Celsius. Calculations/problem-solving: solve problems in context related to temperatures; calculate temperature differences limited to positive whole numbers.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.5 Temperature',
    grade: '5',
    description:
      'Practical measuring: estimate, measure, record, compare and order temperature. Instruments: analogue and digital thermometers. Units: degrees Celsius. Calculations/problem-solving: solve problems in context related to temperatures; calculate temperature differences limited to positive whole numbers.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.6 Perimeter, surface area and volume',
    grade: '4',
    description:
      'Perimeter: measure perimeter using rulers or measuring tapes. Area: find areas of regular and irregular shapes by counting squares on grids to develop understanding of square units. Volume: find volume/capacity of objects by packing or filling them to develop understanding of cubic units.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.6 Perimeter, surface area and volume',
    grade: '5',
    description:
      'Perimeter: measure perimeter using rulers or measuring tapes. Area: find areas of regular and irregular shapes by counting squares on grids to develop understanding of square units. Volume: find volume/capacity of objects by packing or filling them to develop understanding of cubic units.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.6 Perimeter, surface area and volume',
    grade: '6',
    description:
      'Perimeter: measure perimeter using rulers or measuring tapes. Area: continue to find areas of regular and irregular shapes by counting squares on grids; develop rules for calculating areas of squares and rectangles. Volume: continue to find volume/capacity by packing or filling; develop understanding that volume of rectangular prisms = length \u00d7 width \u00d7 height. Investigate: relationship between perimeter and area of rectangles/squares; relationship between surface area and volume of rectangular prisms.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: '4.7 History of measurement',
    grade: '4',
    description:
      'Know some ways in which people measured and recorded measurement in the past.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.1 Collecting and organising data',
    grade: '4',
    description: 'Collect data using tally marks and tables for recording.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.1 Collecting and organising data',
    grade: '5',
    description:
      'Collect data using tally marks and tables for recording; order data from smallest group to largest group.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.1 Collecting and organising data',
    grade: '6',
    description:
      'Collect data using tally marks and tables for recording; using simple questionnaires (yes/no type); order data from smallest group to largest group.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.2 Representing data',
    grade: '4',
    description:
      'Draw a variety of graphs to display and interpret data including pictographs (one-to-one correspondence) and bar graphs.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.2 Representing data',
    grade: '5',
    description:
      'Draw a variety of graphs to display and interpret data including pictographs (many-to-one correspondence) and bar graphs.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.2 Representing data',
    grade: '6',
    description:
      'Draw a variety of graphs to display and interpret data including pictographs (many-to-one correspondence), bar graphs and double bar graphs.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.3 Analysing, interpreting and reporting data',
    grade: '4',
    description:
      'Interpreting data: critically read and interpret data represented in words, pictographs, bar graphs and pie charts. Analysing: answer questions related to data categories. Reporting: summarise data verbally and in short written paragraphs.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.3 Analysing, interpreting and reporting data',
    grade: '5',
    description:
      'Interpreting data: critically read and interpret data in words, pictographs, bar graphs and pie charts. Analysing: answer questions related to data categories, and to data sources and contexts. Reporting: summarise data verbally and in short written paragraphs including drawing conclusions and making predictions. Ungrouped data: examine to determine the most frequently occurring score (mode).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.3 Analysing, interpreting and reporting data',
    grade: '6',
    description:
      'Interpreting data: critically read and interpret data in words, pictographs, bar graphs, double bar graphs and pie charts. Analysing: answer questions related to data categories including data intervals, data sources and contexts, and central tendencies (mode and median). Reporting: summarise data verbally and in short written paragraphs including drawing conclusions and making predictions. Ungrouped data: determine the most frequently occurring score (mode) and the middlemost score (median).',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.4 Probability',
    grade: '4',
    description:
      'Perform simple repeated events and list possible outcomes for: tossing a coin; rolling a die.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.4 Probability',
    grade: '5',
    description:
      'Perform simple repeated events and list possible outcomes for: tossing a coin; rolling a die; spinning a spinner. Count and compare the frequency of actual outcomes for a series of trials up to 20 trials.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: '5.4 Probability',
    grade: '6',
    description:
      'Perform simple repeated events and list possible outcomes for: tossing a coin; rolling a die; spinning a spinner. Count and compare the frequency of actual outcomes for a series of trials up to 50 trials.',
    basis: ref('Section 2.7, Specification of Content (Phase Overview), pages 13-31'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Mental Mathematics (10 minutes daily)',
    grade: '4',
    description:
      'Grade 4 Term 1: Mental Mathematics (10 minutes daily) \u2014 allocated 8 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (3-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 1: Whole numbers: counting, ordering, comparing, representing and place value (3-digit numbers) \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Number sentences',
    grade: '4',
    description:
      'Grade 4 Term 1: Number sentences \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (3-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 1: Whole numbers: addition and subtraction (3-digit numbers) \u2014 allocated 8 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Numeric patterns',
    grade: '4',
    description:
      'Grade 4 Term 1: Numeric patterns \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: multiplication and division (1-digit by 1-digit)',
    grade: '4',
    description:
      'Grade 4 Term 1: Whole numbers: multiplication and division (1-digit by 1-digit) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Time',
    grade: '4',
    description:
      'Grade 4 Term 1: Time \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Data handling',
    grade: '4',
    description:
      'Grade 4 Term 1: Data handling \u2014 allocated 10 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 2-D shapes',
    grade: '4',
    description:
      'Grade 4 Term 1: Properties of 2-D shapes \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication and division (2-digit by 1-digit)',
    grade: '4',
    description:
      'Grade 4 Term 1: Whole numbers: multiplication and division (2-digit by 1-digit) \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 1: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision',
    grade: '4',
    description:
      'Grade 4 Term 1: Revision \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Mental Mathematics (10 minutes daily)',
    grade: '4',
    description:
      'Grade 4 Term 2: Mental Mathematics (10 minutes daily) \u2014 allocated 7 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers) \u2014 allocated 1 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '4',
    description:
      'Grade 4 Term 2: Common fractions \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Length',
    grade: '4',
    description:
      'Grade 4 Term 2: Length \u2014 allocated 7 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (2-digit by 2-digit)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: multiplication (2-digit by 2-digit) \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 3-D objects',
    grade: '4',
    description:
      'Grade 4 Term 2: Properties of 3-D objects \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (2-digit by 2-digit)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: multiplication (2-digit by 2-digit) \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 2: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision',
    grade: '4',
    description:
      'Grade 4 Term 2: Revision \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Assessment (all subjects)',
    grade: '4',
    description:
      'Grade 4 Term 2: Assessment (all subjects) \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Mental Mathematics (10 minutes daily)',
    grade: '4',
    description:
      'Grade 4 Term 3: Mental Mathematics (10 minutes daily) \u2014 allocated 8 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Capacity/volume',
    grade: '4',
    description:
      'Grade 4 Term 3: Capacity/volume \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 3: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '4',
    description:
      'Grade 4 Term 3: Common fractions \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Mass',
    grade: '4',
    description:
      'Grade 4 Term 3: Mass \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 3: Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers) \u2014 allocated 1 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 3: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Geometric patterns',
    grade: '4',
    description:
      'Grade 4 Term 3: Geometric patterns \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '4',
    description:
      'Grade 4 Term 3: Common fractions \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 2-D shapes',
    grade: '4',
    description:
      'Grade 4 Term 3: Properties of 2-D shapes \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: division (3-digit by 1-digit)',
    grade: '4',
    description:
      'Grade 4 Term 3: Whole numbers: division (3-digit by 1-digit) \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 3-D objects',
    grade: '4',
    description:
      'Grade 4 Term 3: Properties of 3-D objects \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Symmetry',
    grade: '4',
    description:
      'Grade 4 Term 3: Symmetry \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Transformations',
    grade: '4',
    description:
      'Grade 4 Term 3: Transformations \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 3: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision',
    grade: '4',
    description:
      'Grade 4 Term 3: Revision \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Mental Mathematics (10 minutes daily)',
    grade: '4',
    description:
      'Grade 4 Term 4: Mental Mathematics (10 minutes daily) \u2014 allocated 7 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: counting, ordering, comparing, representing and place value (4-digit numbers) \u2014 allocated 1 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: division (3-digit by 1-digit)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: division (3-digit by 1-digit) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Numeric patterns',
    grade: '4',
    description:
      'Grade 4 Term 4: Numeric patterns \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (2-digit by 2-digit)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: multiplication (2-digit by 2-digit) \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '4',
    description:
      'Grade 4 Term 4: Common fractions \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Viewing objects',
    grade: '4',
    description:
      'Grade 4 Term 4: Viewing objects \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Data handling',
    grade: '4',
    description:
      'Grade 4 Term 4: Data handling \u2014 allocated 7 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Perimeter, area and volume',
    grade: '4',
    description:
      'Grade 4 Term 4: Perimeter, area and volume \u2014 allocated 7 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Number sentences',
    grade: '4',
    description:
      'Grade 4 Term 4: Number sentences \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (4-digit numbers)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: addition and subtraction (4-digit numbers) \u2014 allocated 4 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (2-digit by 2-digit)',
    grade: '4',
    description:
      'Grade 4 Term 4: Whole numbers: multiplication (2-digit by 2-digit) \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Geometric patterns',
    grade: '4',
    description:
      'Grade 4 Term 4: Geometric patterns \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Transformations',
    grade: '4',
    description:
      'Grade 4 Term 4: Transformations \u2014 allocated 3 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Position and movement',
    grade: '4',
    description:
      'Grade 4 Term 4: Position and movement \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Probability',
    grade: '4',
    description:
      'Grade 4 Term 4: Probability \u2014 allocated 2 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision',
    grade: '4',
    description:
      'Grade 4 Term 4: Revision \u2014 allocated 5 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Assessment (all subjects)',
    grade: '4',
    description:
      'Grade 4 Term 4: Assessment (all subjects) \u2014 allocated 6 hours. See Section 3.3.1 of source document for detailed concepts/skills and teaching guidelines.',
    basis: ref('Section 3, Table: Time allocation per topic Grade 4 (page 34)'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (6-digit numbers)',
    grade: '5',
    description:
      'Order, compare and represent numbers to at least 6-digit numbers; recognise the place value of digits in whole numbers to at least 6-digit numbers; round off to the nearest 5, 10, 100 and 1 000. Prerequisite: place value of 4-digit numbers; rounding off to the nearest 100.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Number sentences',
    grade: '5',
    description:
      'Write number sentences to describe problem situations; solve and complete number sentences by inspection, trial and improvement; check solution by substitution.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Formal Assessment: Assignment (Whole numbers + Number sentences)',
    grade: '5',
    description:
      'Assignment covering whole numbers and number sentences, completed in class within 3 hours.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (5-digit numbers)',
    grade: '5',
    description:
      'Addition and subtraction of whole numbers with at least 5-digit numbers. Calculation techniques (any two of): estimation; adding and subtracting in columns; building up and breaking down numbers; using a number line; rounding off and compensating; using inverse operations. Properties: commutative and associative; 0 in terms of its additive property. Solving problems: financial and measurement contexts.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test',
    grade: '5',
    description:
      'Revision of all Term 1 topics followed by a formal test covering Whole numbers (counting/ordering/comparing/representing/place value) and Whole numbers (addition and subtraction).',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Formal Assessment: Investigation',
    grade: '5',
    description:
      'Investigation on any ONE of the Term 2 topics, administered before teaching that topic.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (3-digit by 2-digit)',
    grade: '5',
    description:
      'Multiplication of at least whole 3-digit by 2-digit numbers. Techniques (any two of): estimation; building up and breaking down; doubling and halving; using multiplication and division as inverse operations. Multiples/factors: multiples of 2-digit whole numbers to at least 100; factors of 2-digit whole numbers to at least 100. Properties: commutative, associative and distributive; 1 in terms of its multiplicative property. Solving problems: financial, measurement contexts; ratio; rate.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: division (3-digit by 2-digit)',
    grade: '5',
    description:
      'Division of at least whole 3-digit by 2-digit numbers. Techniques (any two of): estimation; building up and breaking down; using inverse operations. Properties: distributive property; 1 in terms of its multiplicative property. Solving problems: financial, measurement contexts; ratio; rate; grouping and equal sharing with remainders.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Numeric patterns',
    grade: '5',
    description:
      "Investigate and extend numeric patterns: sequences not limited to constant difference or ratio; of learner's own creation; describe observed relationships or rules in own words. Input and output values using flow diagrams and tables. Equivalent forms: verbally, in a flow diagram, in a table, by a number sentence.",
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Geometric patterns',
    grade: '5',
    description:
      "Investigate and extend geometric patterns: in physical or diagram form; sequences not limited to a constant difference or ratio; of learner's own creation; describe observed relationships in own words. Input and output values using flow diagrams. Equivalent forms: verbally, in a flow diagram, by a number sentence.",
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test (Term 1 and Term 2 work)',
    grade: '5',
    description:
      'Revision of all Term 1 and Term 2 work followed by a formal test covering all topics from Terms 1 and 2.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Formal Assessment: Project (combination of Term 1-3 topics)',
    grade: '5',
    description:
      'Project covering a combination of topics from Terms 1-3, to be completed before end of Term 3. Runs concurrently with teaching during the term.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '5',
    description:
      'Describing and ordering: count forwards and backwards in fractions; compare and order common fractions to at least twelfths. Calculations: addition and subtraction of common fractions with same denominator; addition and subtraction of mixed numbers; fractions of whole numbers resulting in whole numbers; recognise, describe and use the equivalence of division and fractions. Solving problems: contexts involving common fractions including grouping and sharing. Equivalent forms: equivalent forms of common fractions (one denominator is a multiple of another).',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Length',
    grade: '5',
    description:
      'Practical measuring of 2D shapes and 3D objects: estimate, measure, record, compare and order. Instruments: rulers, metre sticks, tape measures, trundle wheels. Calculations and problem-solving: solve problems in context; convert between mm, cm, m, km (whole numbers and common fractions).',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 2-D shapes',
    grade: '5',
    description:
      'Range: regular and irregular polygons \u2014 triangles, squares, rectangles, other quadrilaterals, pentagons, hexagons, heptagons; circles; similarities and differences between squares and rectangles. Characteristics: describe, sort and compare in terms of straight/curved sides, number of sides, lengths of sides, angles (right, smaller than right, greater than right). Angles: recognise and describe right angles, angles smaller and greater than right angles. Further activities: draw 2D shapes on grid paper.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 3-D objects',
    grade: '5',
    description:
      'Range: rectangular prisms and other prisms, cubes, cylinders, cones, pyramids; similarities and differences between cubes and rectangular prisms. Characteristics: describe, sort and compare in terms of shape of faces, number of faces, flat and curved surfaces. Further activities: make 3D models using cut-out polygons; cut open boxes to trace and describe nets.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test (Term 3 topics)',
    grade: '5',
    description:
      'Revision of all Term 3 topics followed by a formal test covering all Term 3 topics.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Perimeter, area and volume',
    grade: '5',
    description:
      'Perimeter: measure perimeter using rulers or measuring tapes. Measurement of area: find areas of regular and irregular shapes by counting squares on grids to develop understanding of square units. Measurement of volume: find volume/capacity of objects by packing or filling them to develop understanding of cubic units.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Capacity/volume',
    grade: '5',
    description:
      'Practical measuring: estimate, measure, record, compare and order capacity/volume of 3D objects. Instruments: measuring spoons, measuring cups, measuring jugs. Units: ml and l. Calculations and problem-solving: solve problems in context; convert between l and ml (whole numbers and fractions).',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Time',
    grade: '5',
    description:
      'Read, tell and write time in 12-hour and 24-hour formats on analogue and digital instruments (clocks, watches, stopwatches) in hours, minutes and seconds. Read calendars. Calculations and problem-solving: calculate time intervals in seconds and/or minutes; minutes and/or hours; hours and/or days; days, weeks and/or months; years and/or decades.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Use all four basic operations to solve problems in context',
    grade: '5',
    description:
      'Solve problems in contexts involving whole numbers and fractions, including: financial contexts; measurement contexts; fractions including grouping and equal sharing; comparing quantities of the same kind (ratio); comparing quantities of different kinds (rate).',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Revision + Formal Assessment: Test (Terms 3 and 4 + fundamental Topics 1 and 2)',
    grade: '5',
    description:
      'Revision followed by a formal test covering Term 3 and 4 topics and fundamental topics from Terms 1 and 2.',
    basis: ref('DBE 2023/24 ATP Grade 5 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Whole numbers: counting, ordering, comparing, representing and place value (9-digit numbers)',
    grade: '6',
    description:
      'Order, compare and represent numbers to at least 9-digit numbers; represent prime numbers to at least 100; recognise the place value of digits in whole numbers to at least 9-digit numbers; round off to the nearest 5, 10, 100 and 1 000.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Whole numbers: addition and subtraction (6-digit numbers)',
    grade: '6',
    description:
      'Addition and subtraction of whole numbers with at least 5-digit and 6-digit numbers. Techniques (any two of): estimation; adding/subtracting in columns; building up and breaking down; rounding off and compensating; using a number line; inverse operations; using a calculator (to check only). Properties: commutative, associative, distributive; 0 in terms of its additive property. Solving problems: financial and measurement contexts.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: multiplication (4-digit by 3-digit)',
    grade: '6',
    description:
      'Multiplication of at least whole 4-digit by 3-digit numbers; multiple operations with or without brackets. Techniques (any two of): estimation; multiplying in columns; building up and breaking down; doubling and halving; inverse operations; calculator (to check only). Multiples/factors/primes: multiples/factors of 2-digit and 3-digit numbers; prime factors to at least 100. Properties: commutative, associative, distributive; 1 in terms of its multiplicative property. Solving problems: financial, measurement contexts; ratio; rate.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Formal Assessment: Assignment (Whole numbers \u2014 place value, addition/subtraction, multiplication)',
    grade: '6',
    description:
      'Assignment covering whole numbers (counting, ordering, comparing, representing, place value; addition and subtraction; multiplication), completed in class within 3 hours.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Whole numbers: division (4-digit by 3-digit)',
    grade: '6',
    description:
      'Division of at least whole 4-digit by 3-digit numbers; multiple operations with or without brackets. Techniques (any two of): estimation; long division; building up and breaking down; inverse operations; calculator (to check only). Properties: distributive property; 1 in terms of its multiplicative property. Solving problems: financial, measurement contexts; ratio; rate; grouping and equal sharing with remainders.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test (all Term 1 topics)',
    grade: '6',
    description:
      'Revision of all Term 1 topics followed by a formal test covering all Term 1 topics.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Formal Assessment: Investigation',
    grade: '6',
    description:
      'Investigation on any ONE of the Term 2 topics, administered before teaching that topic.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Number sentences',
    grade: '6',
    description:
      'Write number sentences to describe problem situations; solve and complete number sentences by inspection and trial and improvement; check solutions by substitution.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Numeric patterns',
    grade: '6',
    description:
      "Investigate and extend numeric patterns: sequences not limited to constant difference or ratio; of learner's own creation; represented in tables; describe general rules for observed relationships. Input and output values using flow diagrams and tables. Equivalent forms: verbally, in a flow diagram, in a table, by a number sentence.",
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Patterns, Functions and Algebra',
    topicCode: null,
    topicName: 'Geometric patterns',
    grade: '6',
    description:
      "Investigate and extend geometric patterns: in physical or diagram form; not limited to constant difference or ratio; of learner's own creation; describe observed relationships in own words. Input and output values using flow diagrams and tables. Equivalent forms: verbally, in a flow diagram, in a table, by a number sentence.",
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Common fractions',
    grade: '6',
    description:
      'Describing and ordering: compare and order common fractions including specifically tenths and hundredths. Calculations: addition and subtraction of common fractions in which one denominator is a multiple of another; addition and subtraction of mixed numbers; fractions of whole numbers. Solving problems: contexts involving common fractions including grouping and sharing. Percentages: find percentages of whole numbers. Equivalent forms: equivalent forms with 1- or 2-digit denominators; equivalence between common fraction and percentage forms.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Decimal fractions',
    grade: '6',
    description:
      'Recognising, ordering and place value: count forwards/backwards in decimal fractions to at least two decimal places; compare and order to at least two decimal places; place value to at least two decimal places. Calculations: addition and subtraction of decimal fractions of at least two decimal places; multiply decimal fractions by 10 and 100. Solving problems: solve problems in context. Equivalent forms: equivalence between common fraction and decimal fraction forms; equivalence between common fraction, decimal fraction and percentage forms.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test (Term 1 and Term 2 topics)',
    grade: '6',
    description:
      'Revision of all Term 1 and 2 work followed by a formal test covering all Term 1 and 2 topics.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Formal Assessment: Project (combination of Term 1-3 topics)',
    grade: '6',
    description:
      'Project covering a combination of topics from Terms 1-3, to be completed before end of Term 3. Runs concurrently with teaching during the term.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Length',
    grade: '6',
    description:
      'Practical measuring of 2D shapes and 3D objects: estimate, measure, record, compare and order. Instruments: rulers, metre sticks, tape measures, trundle wheels. Units: mm, cm, m, km. Calculations and problem-solving: solve problems in context; convert between mm, cm, m, km including common fractions and decimal fractions to 2 decimal places.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 2-D shapes',
    grade: '6',
    description:
      'Range: regular and irregular polygons \u2014 triangles, squares, rectangles, parallelograms, other quadrilaterals, pentagons, hexagons, heptagons, octagons; similarities and differences between rectangles and parallelograms. Features: describe, sort and compare in terms of number of sides, length of sides, and sizes of angles (acute, right, obtuse, straight, reflex, revolution). Further activities: draw 2D shapes on grid paper; draw circles and patterns with compasses. Angles: recognise and name acute, right, obtuse, straight, reflex and revolution angles.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Symmetry',
    grade: '6',
    description: 'Recognise, draw and describe lines of symmetry in 2-D shapes.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Transformations and enlargements/reductions',
    grade: '6',
    description:
      'Use transformations (rotation, translation, reflection) to make composite 2D shapes with line symmetry and tessellated patterns. Describe patterns referring to lines, 2D shapes, 3D objects, lines of symmetry, rotations, reflections and translations. Enlargements and reductions: draw enlargements and reductions of 2D shapes (triangles and quadrilaterals) to compare size and shape.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Space and Shape (Geometry)',
    topicCode: null,
    topicName: 'Properties of 3-D objects',
    grade: '6',
    description:
      'Range: rectangular prisms, cubes, tetrahedrons, pyramids; similarities and differences between tetrahedrons and other pyramids. Characteristics: describe, sort and compare in terms of number and shape of faces, number of vertices, number of edges. Further activities: make 3D models using drinking straws/toothpicks and nets.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Perimeter, area and volume',
    grade: '6',
    description:
      'Perimeter: measure perimeter using rulers or measuring tapes. Area: continue to find areas by counting squares on grids; develop rules for calculating areas of squares and rectangles. Volume: continue to find volume/capacity by packing or filling; develop understanding that volume of rectangular prisms = length \u00d7 width \u00d7 height. Investigate: relationship between perimeter and area of rectangles/squares; relationship between surface area and volume of rectangular prisms.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Revision + Formal Assessment: Test (all Term 3 topics)',
    grade: '6',
    description:
      'Revision of all Term 3 topics followed by a formal test covering all Term 3 topics.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Mass',
    grade: '6',
    description:
      'Practical measuring: estimate, measure, record, compare and order mass of 3D objects. Instruments: analogue and digital bathroom/kitchen scales and balances. Units: g and kg. Calculations and problem-solving: solve problems in context; convert between g and kg including fraction and decimal forms to 2 decimal places.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Time',
    grade: '6',
    description:
      'Read, tell and write time in 12-hour and 24-hour formats on analogue and digital instruments (clocks, watches, stopwatches) in hours, minutes and seconds. Read calendars. Calculations and problem-solving: solve problems in context; read time zone maps and calculate time differences; calculate time intervals in seconds/minutes; minutes/hours; hours/days; days/weeks/months; years/decades; centuries/decades/years.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Measurement',
    topicCode: null,
    topicName: 'Capacity and volume',
    grade: '6',
    description:
      'Practical measuring: estimate, measure, record, compare and order capacity/volume. Instruments: measuring jugs. Units: ml, l and kl. Calculations and problem-solving: solve problems in context; convert between kl, l and ml including fraction and decimal forms to 2 decimal places.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Data Handling',
    topicCode: null,
    topicName: 'Data handling',
    grade: '6',
    description:
      'Collecting and organising data: use tally marks and tables; use simple questionnaires (yes/no type); order data from smallest to largest group. Representing data: draw pictographs (many-to-one), bar graphs and double bar graphs. Analysing, interpreting and reporting: critically read and interpret data in words, pictographs, bar graphs, double bar graphs and pie charts; analyse by data categories, intervals, sources/contexts and central tendencies (mode and median); summarise verbally and in writing including conclusions and predictions.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName: 'Use all four basic operations to solve problems in context',
    grade: '6',
    description:
      'Solve problems in contexts involving whole numbers and fractions, including: financial contexts; measurement contexts; fractions (grouping and equal sharing); ratio; rate.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
  {
    contentArea: 'Numbers, Operations and Relationships',
    topicCode: null,
    topicName:
      'Revision + Formal Assessment: Test (Terms 3 and 4 + fundamental Topics 1 and 2)',
    grade: '6',
    description:
      'Revision followed by a formal test covering Terms 3 and 4 topics and fundamental topics from Terms 1 and 2.',
    basis: ref('DBE 2023/24 ATP Grade 6 Mathematics \u2014 term-by-term topic table'),
  },
];

export const CAPS_MATHS_IP_METADATA = {
  documentId: CAPS_MATHS_IP_DOC_ID,
  documentVersion: CAPS_MATHS_IP_VERSION,
  title: 'Mathematics Intermediate Phase Grades 4-6',
  publisher: 'Department of Basic Education, South Africa',
  isbn: '978-1-4315-0491-6',
  phase: 'Intermediate Phase',
  status: 'RATIFIED' as const,
  ratifiedBy: null,
} as const;
