// Age-appropriateness / developmental-readiness clauses — DBE CAPS, Grades R-9.
//
// Source authority: South African Department of Basic Education (DBE), education.gov.za.
// 206 entries across Foundation, Intermediate and Senior Phase, spanning
// 13 subjects and 23 source documents. Every entry is a paraphrase of a clause in a
// real DBE CAPS document (OQ-005: no source PDF text is reproduced, per the same
// copyright-safe "derived structure only" discipline every other curriculum source in
// this directory already follows) — never invented, never synthesised (rule 0.3).
//
// Supplied 2026-08-25 as a structured extraction dataset (see docs/sources/pedagogy/
// age-appropriateness-developmental-readiness/SOURCES.md for full provenance,
// including two entries whose source was verified via a DBE-identical mirror rather
// than the education.gov.za URL directly). `ratifiedBy` is null throughout — a human
// has not yet countersigned this extraction (the same gate every other source in this
// directory is held to).
//
// Deliberately one entry per clause, not one per source document (contrast with this
// directory's own CAPS_CANON files, which group a whole document's topics under one
// key): this dataset exists to be individually retrieved by a RAG query or a guardrail
// check asking "is this developmentally appropriate for grade N" — bundling 20+ unrelated
// clauses under one document key would dilute exactly the retrieval granularity this
// dataset is for.

import type { SourceRef } from '../framework.js';

export type CapsPhase = 'FOUNDATION' | 'INTERMEDIATE' | 'SENIOR';

export interface AgeAppropriatenessSourceEntry {
  readonly phase: CapsPhase;
  /** e.g. "R-3", "4-6", "7". Free text: CAPS phases are not graded uniformly. */
  readonly gradeRange: string;
  readonly subject: string;
  /** Free-form category tag from the extraction pass, e.g. "developmental_pacing",
   * "readiness_gate", "assessment_age_appropriateness" — not a ratified taxonomy,
   * purely descriptive of what kind of developmental-readiness claim this clause makes. */
  readonly clauseType: string;
  /** Paraphrased clause content — see this file's own header for why this is never
   * verbatim source text. */
  readonly content: string;
  readonly source: SourceRef;
}

const DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS = 'age-appropriateness-src-life-skills';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS =
  'age-appropriateness-src-caps-english-hl-grades-r-3-fs';
const DOC_AGE_APPROPRIATENESS_SRC_FAL = 'age-appropriateness-src-fal';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS =
  'age-appropriateness-src-caps-maths-english-gr-r-fs';
const DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3 = 'age-appropriateness-src-grades-1-to-3';
const DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021 =
  'age-appropriateness-src-grade-r-3-coding-and-robotics-draft-caps-final-19mar2021';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB =
  'age-appropriateness-src-caps-ip-home-english-gr-4-6-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB =
  'age-appropriateness-src-caps-ip-fal-english-gr-4-6-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB =
  'age-appropriateness-src-caps-ip-mathematics-gr-4-6-web';
const DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2 =
  'age-appropriateness-src-ns-and-tech-ip-grades-4-6-edited2';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB =
  'age-appropriateness-src-caps-ip-social-sciences-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB =
  'age-appropriateness-src-caps-ip-life-skills-gr-4-6-web';
const DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021 =
  'age-appropriateness-src-grade4-6-coding-and-robotics-draft-caps-final-19march2021';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB =
  'age-appropriateness-src-caps-sp-fal-english-gr-7-9-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_HOME_ENGLISH_GR_7_9_WEB =
  'age-appropriateness-src-caps-sp-home-english-gr-7-9-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9 =
  'age-appropriateness-src-caps-sp-mathematics-gr-7-9';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB =
  'age-appropriateness-src-caps-sp-natural-sciences-gr-7-9-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9 =
  'age-appropriateness-src-caps-sp-social-science-gr-7-9';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9 =
  'age-appropriateness-src-caps-sp-technology-gr-7-9';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9 =
  'age-appropriateness-src-caps-sp-ems-gr-7-9';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB =
  'age-appropriateness-src-caps-sp-creative-arts-gr-7-9-web';
const DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB =
  'age-appropriateness-src-caps-sp-life-orientation-gr-7-9-web';
const DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO =
  'age-appropriateness-src-draft-caps-coding-and-robotics-grades-7-9-department-of-basic-educatio';

export const AGE_APPROPRIATENESS_ENTRIES: readonly AgeAppropriatenessSourceEntry[] = [
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'progression',
    content:
      'Content and context at each grade level is designed to move from simple to complex, building deliberately across the phase rather than repeating at flat difficulty.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles of the National Curriculum Statement',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'developmental_rationale',
    content:
      'Beginning Knowledge, Health Education, Art & Crafts and Physical Education are deliberately grouped under Life Skills specifically to build physical, social, personal, emotional and cognitive development together, rather than as isolated academic content.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Section 2, Introduction to Life Skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'developmental_variance',
    content:
      'Children of the same age are not necessarily at the same stage of physical development; each child should be treated as an individual, with their developmental stage tracked and monitored rather than assumed from age or grade alone.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Physical Education subsection',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'safety_by_age',
    content:
      'Swimming is excluded from the standard programme due to limited school access, but should be included as a physical/sport activity wherever a pool is accessible. Strenuous outdoor activity must be avoided in extremely hot weather.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Physical Education subsection',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'age_appropriateness',
    content:
      'Topics are explicitly chosen to reflect the social, personal, emotional and cognitive needs of children in the phase, not arbitrary content ordering. Grade R uses a compressed 2-week/20-topic structure versus 3-4 weeks/12 topics for Grades 1-3, itself a developmental-pacing decision reflecting shorter attention spans and integrated (not subject-separated) learning at that age.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Topics section',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Life Skills',
    clauseType: 'developmental_readiness',
    content:
      'Learners arrive at school with differing levels of readiness; the first days of Grade R should be used to orient them to classroom and school routine before content instruction begins in earnest.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Grade R, Term 1, Week 1-2 lesson notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'Life Skills',
    clauseType: 'developmental_assessment',
    content:
      "The first three weeks of Grade 1 should be used to conduct an assessment of each child's developmental level before proceeding with the full programme.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Grade 1, Term 1, Week 1-3 lesson notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'emotional_developmental_sensitivity',
    content:
      'Recurring cautions tied to emotional/developmental readiness: family-themed activities (e.g. drawing a family portrait) can be emotionally difficult for a child who has lost a parent or whose parents are separated; teachers should show sensitivity toward children from single-parent or child-headed households and toward dietary topics for indigent learners; many young children may have experienced some form of abuse, and lessons should teach them who they can safely tell.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Recurring lesson-note sensitivity flags (multiple topics across grades)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'safety_and_inclusion',
    content:
      "Every PE lesson must open with a warm-up and close with a cool-down; activities must suit the school's own context and available equipment; outdoor play must always be supervised; children with physical disabilities must be accommodated in every lesson.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Physical Education, recurring lesson notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Life Skills',
    clauseType: 'assessment_age_appropriateness',
    content:
      'Grade R has no Formal Assessment Tasks at all - assessment is observation, oral and practical only. Formal written testing is treated as developmentally inappropriate at this stage.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Assessment in Life Skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Life Skills',
    clauseType: 'assessment_age_appropriateness',
    content:
      'Assessment across Grades 1-3 relies on checklists and holistic rubrics tracking participation and skill demonstration rather than written tests, consistent with age-appropriate assessment methods for this phase.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Assessment in Life Skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Life Skills',
    clauseType: 'inclusion',
    content:
      'Not all children can participate identically in Music, Dance, Drama, Art & Crafts or PE due to physical disabilities (hearing, speech, vision, limb differences); activities must be adapted so every child has an equal and fair opportunity to participate.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_LIFE_SKILLS,
      documentVersion: 'caps-current',
      clause: 'Managing Barriers to Learning',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Home Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex, the same core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Home Language',
    clauseType: 'developmental_readiness',
    content:
      'Reading groups are formed by observed instructional reading level, not by age or grade alone. A suitable text should be readable with ease but still offer a few challenges; children should decode 90-95% of words correctly, read fluently with expression, show interest, not need to finger-point, and be able to read silently - these behavioural markers, not chronological age, determine grouping and text selection.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.6.4 Forming ability groups',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Home Language',
    clauseType: 'age_differentiated_technique',
    content:
      'The same reading strategy is explicitly delivered differently by developmental stage: with very young children the teacher briefly talks through illustrations; with older children the teacher instead teaches them to browse captions, chapter headings, table of contents and sub-headings.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.6.4 Steps in a Group Guided Reading Lesson, step III',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'Home Language',
    clauseType: 'developmental_progression',
    content:
      "Writing ability is expected to progress in a defined developmental sequence within Grade 1 itself: children begin by 'writing' through pictures, then as letter-formation skill matures they copy individual words, captions and full sentences, reaching the ability to write their own caption and construct at least one sentence by the middle of the year - with sentence starters and frames used to scaffold this transition.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'Home Language',
    clauseType: 'readiness_prerequisite',
    content:
      'Before formal handwriting instruction begins in Grade 1, children must first go through a pre-writing programme developing visual discrimination, gross and fine motor control, hand-eye coordination and body image - handwriting is not started cold.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing / Handwriting - Pre-writing programme',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Home Language',
    clauseType: 'developmental_limitation',
    content:
      'Young children often struggle to copy from the board because their eyes need time to refocus between board and page and their short-term visual memory may not yet be developed; teachers are directed to give children in Grades 1-3 individual writing strips instead of relying on board-copying.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing / Handwriting - Pre-writing programme',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Home Language',
    clauseType: 'developmental_pacing',
    content:
      'Writing materials are paced to developmental stage rather than fixed by calendar: Grade 1 begins on blank paper with wax crayons, progresses to 17mm-lined paper with pencils, and by Grade 3 transitions to 8.5mm lined books - with the exact timing of each transition left to depend on the level of the individual children and school policy, not a mandated date.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing / Handwriting - Materials',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '2-3',
    subject: 'Home Language',
    clauseType: 'developmental_pacing',
    content:
      'By the end of Grade 1 children should form all upper/lower-case letters fluently; Grade 2 is where most schools begin teaching joined/cursive script; children should be writing some form of cursive by the end of Grade 3, with most making the actual transition during the first half of Grade 3 - a staged, not instantaneous, skill transition.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing / Handwriting - Transition to cursive',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Home Language',
    clauseType: 'individual_tracking',
    content:
      "Language periods should provide time to support children with barriers to learning and enrichment for those doing well; written work must be marked and overseen so each individual child's progress can be tracked and monitored, and used to inform next instructional steps.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Writing - Barriers to learning',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'core_pedagogy_principle',
    content:
      "Grade R language learning is explicitly built on principles of integration and play-based learning, not direct instruction. The teacher's role is defined as a 'mediator' rather than a 'facilitator' - one who makes the most of incidental learning opportunities that arise spontaneously through child-centred activities such as free-play in the fantasy corner or block construction, alongside teacher-directed 'rings' (story ring, discussion ring, etc.).",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'explicit_prohibition',
    content:
      "A traditional, formal, tightly-structured, 'basics bound' classroom programme should be avoided in Grade R because it does not optimise literacy acquisition at this developmental stage. Grade R must not be treated as a 'watered down' Grade One - it has its own unique characteristics based on how children in this age group make sense of their world.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'core_developmental_sequencing_principle',
    content:
      'Young children are stated to learn best kinaesthetically (through movement) first, then through interacting with concrete, three-dimensional materials, and only after that through table-top, two-dimensional, paper-and-pencil representational activities. This concrete-before-abstract sequencing underpins the entire Grade R daily programme design.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'assessment_age_appropriateness',
    content:
      "Assessment practices in Grade R must be informal; children should never be placed in a 'test' situation. For this reason no Formal Assessment Activities are included in the Grade R CAPS document at all - assessment happens through ongoing observation, with the teacher recording results on a checklist so a full picture of each child's challenges and strengths builds gradually across the year.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R - Assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'developmental_rationale',
    content:
      "Perceptual work (visual discrimination, memory, sequencing, foreground/background separation) is described as 'extremely important' in Grade R because it underpins and prepares the foundations for future literacy learning; sufficient daily time must be spent building these perceptual skills before formal reading instruction is expected to succeed.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '3.1 Grade R, Term 1, Listening and Speaking',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Home Language',
    clauseType: 'within_grade_developmental_benchmarks',
    content:
      'Expected skill complexity is explicitly staged term-by-term within Grade R itself, not just grade-by-grade: jigsaw puzzle competence expected rises from 5+ pieces (Term 1) to 10+ pieces (Term 2) to 10-20 pieces (Term 3) to 20+ pieces (Term 4); recalled word-sequence length grows from three words toward four or more across the same terms - concrete, measurable developmental-readiness benchmarks within a single school year.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_ENGLISH_HL_GRADES_R_3_FS,
      documentVersion: 'caps-current',
      clause: '3.1 Grade R, Terms 1-4 content progression',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'First Additional Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the same core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'First Additional Language',
    clauseType: 'differential_starting_point',
    content:
      'FAL teaching cannot mirror Home Language teaching because children arrive at school already fluent in their mother tongue but with little or no prior knowledge of the additional language, and the Home Language is reinforced informally all day both in and out of school while the additional language often has no support at home - this asymmetry must shape pedagogy from the outset.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 2, Teaching and Learning a First Additional Language',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-1',
    subject: 'First Additional Language',
    clauseType: 'readiness_prerequisite',
    content:
      'Children cannot begin the formal learning of reading and writing in an additional language until they can first understand and speak it; Grade R and most of Grade 1 are therefore deliberately focused on developing oral skills before literacy instruction starts.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 5, Listening and Speaking',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'First Additional Language',
    clauseType: 'paced_cognitive_load',
    content:
      'New vocabulary must be introduced in small, deliberately paced doses matched to developmental capacity: approximately 3-4 new words a day initially, extending later to 5-7 words a day - teaching too many words at once is explicitly discouraged.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 5, Vocabulary development',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'First Additional Language',
    clauseType: 'readiness_gate',
    content:
      'Formal reading instruction in the FAL may only begin once learners have basic oral competence in the FAL and already have basic reading skills in their Home Language. Until that point - typically the second half of Grade 1 - FAL reading and writing must stay informal (labelling, read-alouds, teacher-scribed attempts) rather than moving to structured reading instruction.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 7, Starting formal reading',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'First Additional Language',
    clauseType: 'age_appropriateness',
    content:
      'As a guideline, learners should already know 90-95% of the vocabulary in a text for comprehension to occur; reading materials must therefore be geared toward age-appropriate texts using simple, high-frequency sight vocabulary rather than texts chosen for topic interest alone.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 7, Starting formal reading',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'First Additional Language',
    clauseType: 'sequencing',
    content:
      'Learners must be secure with short-vowel sounds before long vowels and other vowel patterns are introduced in Grades 2 and 3 - a deliberate difficulty-ordering rule, not an incidental one.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 7, Phonics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'First Additional Language',
    clauseType: 'developmental_progression',
    content:
      'Writing ability is staged more slowly than in Home Language, reflecting the added language-acquisition load: Grade 1 begins with drawing to show understanding, moving to copying individual words and captions; only by the middle of Grade 2 are learners expected to copy full sentences, complete sentences with a missing word, and write their own captions; by Grade 3 they are expected to construct just one to two short sentences independently.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 8, Writing',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'First Additional Language',
    clauseType: 'core_pedagogy_principle',
    content:
      "Grade R FAL organisation is based on the same integration and play-based learning principle as Home Language; a traditional, formal classroom-based programme should be avoided, with focused learning delivered through 'rings' during the day alongside optimal free-play time. Grade R must not be treated as a 'watered down' Grade One - it has its own unique characteristics.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 9, Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'First Additional Language',
    clauseType: 'assessment_age_appropriateness',
    content:
      "Assessment in Grade R FAL must be informal; learners should never be placed in a 'test' situation. No Formal Assessment Tasks are included anywhere in the Grade R FAL CAPS document (confirmed repeatedly, term by term, as 'No Formal Assessment'); assessment happens through planned, integrated activities observed and recorded on a checklist.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Section 9, Grade R - Assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'First Additional Language',
    clauseType: 'developmental_readiness',
    content:
      'Group Guided Reading groups learners by same-ability level, matching each learner to texts at their instructional level defined as 90-95% word-recognition accuracy - grouping is by demonstrated reading competence, not age or grade alone, mirroring the same principle set out in the Home Language CAPS.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Grade 2, Term 1, Group Guided Reading instructions',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '2',
    subject: 'First Additional Language',
    clauseType: 'age_appropriateness',
    content:
      'Paired-reading material must explicitly be age appropriate in reading level, with learners using their phonic knowledge to sound out unfamiliar words rather than being handed texts chosen without regard to their current reading stage.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_FAL,
      documentVersion: 'caps-current',
      clause: 'Grade 2, Term 3, Paired Reading note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Mathematics',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Mathematics',
    clauseType: 'developmental_rationale',
    content:
      "Foundation Phase Mathematics is framed as the bridge between a child's pre-school life and the abstract mathematics of later grades; activities must give learners many chances to 'do, talk and record' their mathematical thinking, and must never be mere 'keep busy' activities disconnected from the actual mathematics being built.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.7 Mathematics in the Foundation Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Mathematics',
    clauseType: 'developmental_readiness',
    content:
      'Small-group teaching should use same-ability groups of 8-12 learners so the difficulty level can be matched to the group; mixed-ability groups are acceptable for construction, measurement, patterning/sorting and games, but not recommended for core skill-building sessions. Teachers are explicitly cautioned not to underestimate slower learners - they must be stretched too, not simply given less.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.7.1 Suggested guidelines for classroom management',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Mathematics',
    clauseType: 'developmental_accommodation',
    content:
      'Learners with barriers to learning Mathematics need longer exposure to activity-based, concrete-object learning; moving them to abstract work too soon is explicitly flagged as a cause of frustration and regression. These learners should be granted more time to complete assessment tasks and to develop their own thinking strategies, with the number (not the substance) of activities adapted to their pace.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.7.2 Learners with barriers to learning Mathematics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Mathematics',
    clauseType: 'developmental_accommodation',
    content:
      'Teachers must never force learners into mental calculations they cannot handle; writing materials and/or physical counters must always be available as a fallback for learners who still need them, rather than mental-only computation being mandated uniformly.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.7.3 Mental mathematics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'core_developmental_sequencing_principle',
    content:
      'Emergent mathematics acquisition is explicitly required to move through three named developmental stages in order: the kinaesthetic stage (experiencing concepts with the body and senses), the concrete stage (using 3-D physical objects such as blocks, bottle tops, twigs), and only then paper-and-pencil representation (semi-concrete drawings, matching cards). This is the same concrete-before-abstract principle stated in Home Language and FAL Grade R sections, here made explicit and named as formal stages specific to mathematics.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'core_pedagogy_principle',
    content:
      "Grade R mathematics approach must be based on integration and play-based learning, with the teacher acting as 'mediator' rather than 'facilitator' - making the most of incidental learning opportunities in child-centred activities (fantasy play, block construction, sand/water play) as well as teacher-guided ring time, rather than delivering mathematics as isolated direct instruction.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'assessment_age_appropriateness',
    content:
      "Assessment in Grade R must be informal; children must never be placed in a 'test' situation. No assessment activities are included in the Grade R Mathematics CAPS document for this reason - assessment happens through ongoing observation, recorded on a checklist, building a full picture of each child's challenges and strengths across the year.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R - Assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'explicit_prohibition',
    content:
      "A traditional, formal, tightly-structured, 'basics bound' classroom programme should be avoided in Grade R because it does not optimise numeracy acquisition at this stage. Grade R must not be treated as a 'watered down' Grade 1 class - it has its own unique characteristics based on how children in this age group make sense of their world.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '2.8 Grade R',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Mathematics',
    clauseType: 'developmental_pacing',
    content:
      'A full week is deliberately allowed for orientation and consolidation at the start of each term, and another week for consolidation at the end, because young children are stated to forget significant content over school holidays and need time to re-settle into the rhythm of schooling before new content resumes.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '3.4 Sequencing and pacing of content',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'developmental_limitation',
    content:
      'Grade R problems must initially use only real objects physically present in the classroom (counters, children, shoes), not abstract stand-ins - the document states plainly that not all young children can pretend a counter or a finger represents something else (e.g. a rabbit); they need the real object itself. Pictures may only be introduced from the second half of the year, and even then as an addition to concrete objects, never as a replacement for them.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: 'Grade R Overview, Problem Types note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'anti_underestimation',
    content:
      'Teachers are explicitly instructed to mix problem types from day to day and to gradually increase the size of numbers used, rather than assuming learners cannot cope with bigger numbers - a counter-balance against underestimating readiness, paired with the caution against pushing abstraction too early.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: 'Grade R Overview, Problem Types note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'within_grade_developmental_benchmarks',
    content:
      'Jigsaw puzzle competence is set as a measurable term-by-term benchmark within Grade R itself: a minimum of 6 pieces by the end of Term 1, 12 pieces by Term 2, 18 pieces by Term 3, and 24 pieces by Term 4 - a concrete, escalating developmental-readiness marker independent of any single lesson.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: 'Grade R Overview, 2-D Shapes / Puzzles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'staged_scaffolding_reduction',
    content:
      "Classroom identity labels are staged across the year to match emerging literacy: only the learner's symbol/photo is displayed for the first three months, before name-only labels are introduced for the final six months - a deliberate, timed reduction of visual scaffolding as reading readiness develops.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: 'Grade R Overview, 2-D Shapes / classroom labelling',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'structural_age_difference',
    content:
      "Grade R Mathematics is explicitly delivered as 'emergent mathematics' and is therefore not broken into discrete lesson periods the way Grades 1-3 are; the teacher is expected to weave mathematics into daily activities throughout the day, with only some dedicated focused episodes, reflecting a structurally different approach to time and content delivery at this developmental stage.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_MATHS_ENGLISH_GR_R_FS,
      documentVersion: 'caps-current',
      clause: '3.4 Sequencing and pacing, Grade R lesson planning',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'readiness_gate',
    content:
      'Each new mathematics concept must pass through three stages in strict order - kinaesthetic (body and senses), concrete (3-D objects), then semi-concrete (paper representation: drawings, matching pictures, card games, worksheets) - and the document states explicitly that worksheets may only be given once learners have presented and mastered the earlier stages, not introduced in parallel or ahead of them.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3,
      documentVersion: 'caps-current',
      clause: '2.3.2 General notes for Grade R Mathematics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Mathematics',
    clauseType: 'developmental_pacing',
    content:
      "Grade R teaching is described as informal but structured - 'play with a purpose' - with orientation occupying the first three weeks of the year to introduce key classroom charts (weather, birthday, etc.); actual content teaching only commences in week four, once routines are established.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3,
      documentVersion: 'caps-current',
      clause: '2.3.2 General notes for Grade R Mathematics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Mathematics',
    clauseType: 'mastery_before_progression',
    content:
      "All concepts must be thoroughly taught before moving to the next; learners' abilities must be taken into account when choosing among possible alternative teaching methods; and every activity is designed to consolidate knowledge across the concrete, semi-concrete and abstract levels in turn - extending the Grade R concrete-to-abstract sequencing principle through Grades 1-3.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3,
      documentVersion: 'caps-current',
      clause: '2.3.3 General notes for Grade 1-3 mathematics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'Mathematics',
    clauseType: 'developmental_pacing',
    content:
      'Grade 1 Term 1 opens with a dedicated orientation week (completing the register, weather chart, birthday chart, name cards) before content instruction proper begins - the same settling-in structure used in Grade R, now carried into Grade 1.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3,
      documentVersion: 'caps-current',
      clause: 'Term 1, Grade 1, Week 1, Orientation',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1',
    subject: 'Mathematics',
    clauseType: 'differentiated_developmental_accommodation',
    content:
      'The document explicitly acknowledges that learners within the same class are at different developmental levels of listening, addition and subtraction skill at the same point in the year. The teacher is instructed to read story sums aloud (rather than requiring independent reading, which would confound the maths assessment with reading ability), and different learners are explicitly permitted to solve the same problem using counters, drawings, number lines, or mental calculation - multiple solution pathways accommodated simultaneously rather than one method mandated for all.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_GRADES_1_TO_3,
      documentVersion: 'caps-current',
      clause: 'Term 3, Grade 1, Week 25, Addition note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Coding and Robotics',
    clauseType: 'readiness_framing',
    content:
      "Foundation Phase delivery is explicitly anchored to the National Early Learning Development Standards (NELDS): there are specific skills very young learners must master before Grade 1, and Grade R's job is to help build those prerequisite skills, not to teach digital content for its own sake.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5 Teaching Coding and Robotics in Foundation Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Coding and Robotics',
    clauseType: 'safety_first_principle',
    content:
      'One of the most important roles of the Grade R teacher is described as providing an environment that is safe, clean and caring, with adequate opportunity to play and explore under careful guidance - safety and care are named ahead of content delivery for this age group.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5 Teaching Coding and Robotics in Foundation Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'age_appropriateness',
    content:
      "Teachers must provide routine, structured and free-play coding/robotics activities that are explicitly 'enjoyable and manageable' for the age group, and routine/free-play activities are deliberately built into the CAPS document because they naturally involve physical movement - digital/abstract content is anchored to physical activity at this stage, not delivered screen-first.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5 Teaching Coding and Robotics in Foundation Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'developmental_prerequisite_domain',
    content:
      'The subject explicitly names development of underlying perceptual-motor skills as a purpose of its free-play and coding-card activities: visual perception, visual discrimination, visual memory, auditory perception, auditory discrimination, auditory memory, hand-eye coordination, body image, laterality, dominance, crossing the mid-line, figure-ground perception, form perception, and spatial orientation. These are framed as foundational to later reading, writing and mathematics, not merely incidental to coding content.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5.6 Perceptual skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'named_ecd_principle',
    content:
      'Topic order follows a named early-childhood-education principle stated explicitly in the document: begin with what is familiar to the learner and introduce less-familiar topics and skills later. Teachers may vary the topic sequence but must still respect this progression and the level at which each topic is pitched.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5.9 Sequencing and Progression',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'process_skill_progression',
    content:
      'As learners progress through the phase, they are expected to demonstrate increasing accuracy and skill, better organisation, and safer working practices - progression is tracked in process maturity (how they work), not only in content mastered.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '2.5.1 Engineering Design Process (IDMEC)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R',
    subject: 'Coding and Robotics',
    clauseType: 'within_grade_developmental_benchmarks',
    content:
      'Pattern complexity is staged term-by-term within Grade R itself: patterns repeating up to 2 times with a minimum of 2 repetitions in Term 1, rising to patterns repeating up to 3 times with a minimum of 3 repetitions by Term 4. Robot logic-instruction sequences follow the same pattern: a minimum of 4 instructions in Term 2 rising to a minimum of 8 instructions by Term 3 - concrete, escalating readiness benchmarks within one school year, mirroring the pacing style seen in Mathematics.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: 'Grade R Annual Teaching Plan, Terms 1-4',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: '1-3',
    subject: 'Coding and Robotics',
    clauseType: 'grade_to_grade_progression',
    content:
      "Pattern and coding-block complexity scales visibly by grade: Grade 1 introduces block-based coding sequences starting at a minimum of 1 instructional block and progressing to a maximum of 4 within a single activity; Grade 2 introduces number-pattern creation using multiples; Grade 3 introduces encode/decode tasks using full sentences of 5-7 words - each grade's ceiling becoming roughly the next grade's floor.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: 'Grade 1-3 Annual Teaching Plans',
      ratifiedBy: null,
    },
  },
  {
    phase: 'FOUNDATION',
    gradeRange: 'R-3',
    subject: 'Coding and Robotics',
    clauseType: 'age_scaled_time_allocation',
    content:
      'Instructional time itself is age-scaled: Coding and Robotics receives only 1 hour per week in Grades R-2, rising to 2 hours per week in Grade 3 - a deliberate increase in exposure time as learners approach the Intermediate Phase.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE_R_3_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MAR2021,
      documentVersion: 'draft-2021',
      clause: '1.4.1 Time Allocation',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'individualized_pacing',
    content:
      "Learners' spoken language still needs active support and modelling at this phase (vocabulary, sentence frames); because learners progress at different paces, teachers must tailor speaking opportunities and the questions they ask to each individual child's level, not deliver a single uniform standard to the whole class. As learners move through the grades, their utterances are expected to grow both longer and more complex.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.2 Listening and Speaking',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Home Language',
    clauseType: 'readiness_threshold',
    content:
      'Many children switch to using their additional language (English) as the Language of Learning and Teaching starting in Grade 4, which means they are expected to reach a high level of competence in that language, including reading and writing well, by the end of Grade 3 - the Foundation Phase exit point is treated as a hard readiness threshold for this transition.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.1 Language levels',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'realistic_gap_acknowledgment',
    content:
      "The document explicitly acknowledges that although learners should be reasonably proficient in their First Additional Language by Senior Phase, many still cannot communicate well in it at that stage. It states the Intermediate Phase's challenge is therefore dual: provide support for learners not yet at the expected level while still delivering a curriculum that meets the standards required for later grades - not resolved by lowering standards or ignoring the gap.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.1 Language levels',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Home Language',
    clauseType: 'phase_transition_scaffolding',
    content:
      'Teachers are told to build on the foundation set in Grades R-3, and if necessary to use shared reading at the very start of Grade 4 specifically to guide learners into the Intermediate Phase - an explicit bridging technique at the phase boundary, comparable to the orientation-week pattern used at the start of Foundation Phase grades.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.2 Reading and Viewing',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'quantified_grade_benchmarks',
    content:
      'Text length expectations are explicitly quantified and scaled by grade: for texts learners produce, paragraphs run 50-60 words/5-6 sentences in Grade 4, rising to 60-80 words/6-8 sentences in Grade 5, and 80-100 words/8-10 sentences in Grade 6 (essays, stories and summaries scale similarly). For texts learners engage with, longer listening comprehension passages run 150-200 words in Grade 4 up to 250-300 words in Grade 6, while reading comprehension texts run 150-200 words (Gr4) to 250-300 words (Gr6).',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.2.3-3.2.4 Length of Texts tables',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'quantified_grade_benchmarks',
    content:
      'Vocabulary size targets are set term-by-term per grade: Grade 4 common spoken vocabulary is expected to grow from roughly 1700-2500 words in Term 1 to 3500-4000 by Term 4; Grade 5 from about 2400-4000 to 4500-5000; Grade 6 from about 3500-5000 to 5500-6000. Reading (new-word) vocabulary targets scale separately and in parallel.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.2.5 Vocabulary to be achieved',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'modality_readiness_gap',
    content:
      'The text learners listen to in a given cycle is deliberately set at a higher level than the text they read in the same cycle, because listening skills are more developed than reading skills at this stage - text difficulty is calibrated per modality, not applied uniformly across listening, reading and writing.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.3.2 How texts/activities are sequenced',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'within_year_load_progression',
    content:
      'Cognitive load is deliberately staged across the year: early in the year there is usually only one text type or activity per two-week cycle, later increasing to two and sometimes three text types or activities per cycle as learners build capacity.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.3.4 Number of key texts in a two-week cycle',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Home Language',
    clauseType: 'grade_to_grade_intensity_scaling',
    content:
      'Explicit language-structure activities are meant to increase in frequency and depth as learners progress from Grade 4 to Grade 6, with teachers instructed to select grammar rules carefully and keep direct explanation to a minimum, relying instead on contextual practice within real texts rather than isolated drills.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_HOME_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.3.5 How Language Structures and Conventions are addressed',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'First Additional Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'First Additional Language',
    clauseType: 'readiness_stakes',
    content:
      'Reading is described as especially critical for children about to use English as Language of Learning and Teaching in Grade 4, because they will need to read and write in that language across all their other subjects; this requires high literacy levels and a wide vocabulary, so FAL reading instruction is framed as carrying stakes beyond the language subject itself.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.2 Reading and Viewing',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'First Additional Language',
    clauseType: 'extra_scaffolding_requirement',
    content:
      'The text-based teaching approach is explicitly flagged as requiring considerably more modelling, support and scaffolding in the First Additional Language classroom than would be needed in a Home Language classroom covering the same approach.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.3 Language teaching approaches',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '6',
    subject: 'First Additional Language',
    clauseType: 'developmental_time_reallocation',
    content:
      'Weekly time allocation across skills shifts by grade even though total FAL hours stay the same: Reading and Viewing gets 5 hours in Grades 4 and 5 but drops to 4 hours in Grade 6, while Writing and Presenting rises from 2 hours (Gr4-5) to 3 hours in Grade 6 - a deliberate shift of instructional weight toward writing as learners mature.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.2 Time allocation for FAL',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'First Additional Language',
    clauseType: 'quantified_grade_benchmarks_below_HL',
    content:
      'FAL text-length targets are explicitly lower than the parallel Home Language targets at the same grade: FAL Grade 4 paragraphs run 30-40 words/4-5 sentences (versus 50-60 words/5-6 sentences for HL Grade 4); FAL Grade 6 paragraphs run 50-60 words/6-8 sentences (versus 80-100 words/8-10 sentences for HL Grade 6). The gap is a deliberate, quantified acknowledgment of the added language-acquisition load in an additional language.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.2.3-3.2.4 Length of Texts tables',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'First Additional Language',
    clauseType: 'quantified_grade_benchmarks_below_HL',
    content:
      "FAL vocabulary targets are set lower than the parallel Home Language targets at the same grade and term: FAL Grade 4 common spoken vocabulary runs roughly 1600-2000 words (Term 1) to 2000-3500 (Term 4), versus HL Grade 4's 1700-2500 to 3500-4000 over the same terms - reflecting a deliberately smaller vocabulary load for an additional language at the same age.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.2.5 Vocabulary to be achieved',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'First Additional Language',
    clauseType: 'acquisition_over_explicit_instruction',
    content:
      'Teachers are told to select very carefully which grammar rules they explain and to keep explicit explanation to a minimum, because First Additional Language learners are understood to primarily learn a language through constant exposure to it and through using it, not through direct rule instruction - explicit grammar teaching is treated as a minor supplement to immersion, not the primary route.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_FAL_ENGLISH_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '3.3.5 How Language Structures and Conventions are addressed',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'forward_looking_readiness_rationale',
    content:
      'Numbers, Operations and Relationships is deliberately weighted at 50% of teaching time across all three grades specifically as an attempt to ensure learners are sufficiently numerate by the time they enter Senior Phase - the weighting decision is explicitly justified by a downstream readiness goal, not just current-grade content volume.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.6 Weighting of content areas',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'readiness_gate',
    content:
      'More efficient calculation techniques (columns, calculator use) should only be introduced and encouraged once learners already have an adequate sense of place value and understanding of number/operation properties - technique upgrades are explicitly gated on conceptual readiness, not introduced on a fixed schedule.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Specification of Content, Numbers Operations phase overview',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Mathematics',
    clauseType: 'systematic_within_year_pacing',
    content:
      'The mental mathematics programme must be built up systematically across the year, not delivered as random daily calculations; the number range is deliberately kept lower in Term 1 and increased as the year progresses, with Term 1 starting point explicitly anchored to what was developed in the previous grade (Grade 3).',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1, Mental Mathematics clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'grade_transition_consolidation',
    content:
      "Nearly every topic's Term 1 clarification note instructs teachers to 'revise and consolidate work done in [the previous grade]' before extending it, and is paired with an explicit 'What is different to Grade [previous]?' callout that isolates exactly what content is new - a structural, document-wide mechanism ensuring teachers don't assume prior-grade mastery without checking it first.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Recurring across Grade 4-6 term clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'concept_before_terminology',
    content:
      "Learners are repeatedly and explicitly stated as NOT expected to know or use formal terminology (e.g. 'inverse operations', 'commutative property', 'associative property', 'distributive property') at this stage - they are only expected to use the underlying technique functionally (e.g. use addition to check subtraction). Functional understanding is required; the formal vocabulary for it is deferred, consistently enforced across every property introduced in the phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1, Number sentences clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Mathematics',
    clauseType: 'scaffolded_first_instance',
    content:
      "For the very first data-summary activity of the year, teachers are told they 'will need to guide learners' through writing a complete summary paragraph - explicit first-instance scaffolding before learners are expected to do the same task independently later in the year.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1, Data Handling clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Mathematics',
    clauseType: 'continuous_skill_reinforcement',
    content:
      'Time-telling is explicitly required to be practised at frequent intervals throughout the entire year (e.g. during mental maths time or transition moments), not taught once as a discrete unit and left - a skill treated as needing continuous reinforcement rather than one-off instruction.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1, Time clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Mathematics',
    clauseType: 'explicit_scope_ceiling',
    content:
      'Learners in this phase are explicitly stated as not expected to calculate the probability of events occurring - probability work is capped at listing, counting and predicting outcomes from repeated trials, with formal probability calculation deferred beyond the phase; this is a stated ceiling on scope, not an oversight.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_MATHEMATICS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Specification of Content, Data Handling phase overview',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'developmentally_appropriate_values',
    content:
      'Investigative skill-building is explicitly paired with values appropriate to this age: learners should not strip leaves off bushes just to compare them, and if they examine small animals they must care for them and release them unharmed where they were found - respect for living things is taught as inseparable from the practical skill of investigation, not as a separate lesson.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: '2.7 Major Process and Design Skills, Specific Aim 1',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'safety_constrained_group_size',
    content:
      'For safety and educational reasons, no more than three learners should share investigation space and equipment at a time - a concrete group-size ceiling justified by both safety and learning quality at this age, not merely a resourcing convenience.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: '2.8 Resources',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'experience_over_equipment_priority',
    content:
      'It is explicitly stated as more important for learners to have the experience of carrying out varied investigations and building their own technology models than to depend on availability of ideal equipment; where equipment is genuinely unavailable, a teacher demonstration is preferred over skipping the investigation entirely - hands-on experience is prioritised as the developmentally necessary component, with equipment quality treated as secondary.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: '2.8 Resources',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'explicit_scope_ceiling',
    content:
      "Content tables repeatedly and explicitly cap depth per grade with notes such as: details of how muscles attach to joints are 'not required' in Grade 5's skeleton topic; Grade 6 learners 'do not have to know how Watts are measured and calculated' for electricity; exact planet sizes and moon counts 'need not be memorised' in Grade 6 astronomy; and photosynthesis needs 'no further detail... learners will deal with it in detail only in higher grades.' These ceilings are a consistent, deliberate design feature limiting scope to what is developmentally appropriate for the grade, deferring depth to later phases rather than an oversight.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: 'Recurring across Grade 4-6 content tables',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '5',
    subject: 'Natural Sciences and Technology',
    clauseType: 'long_duration_investigation_accommodation',
    content:
      'For investigations that take longer than a single lesson (e.g. observing rusting over time, or a month-long Moon-watch), learners are explicitly told to continue with other work while the slow process unfolds in the background, rather than waiting idle - long-duration science is integrated into the ongoing school day rather than requiring sustained single-sitting attention.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: 'Grade 5 Term 2, Uses of Metals; Grade 4 Term 4, The Moon',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '5',
    subject: 'Natural Sciences and Technology',
    clauseType: 'safety_restricted_participation',
    content:
      "A catapult activity is explicitly flagged as 'extremely dangerous' and restricted to teacher demonstration only - not a hands-on learner activity - an explicit safety-based restriction on which activities learners may physically perform versus only observe at this age.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: 'Grade 5 Term 3, Energy and Movement',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Natural Sciences and Technology',
    clauseType: 'integrated_literacy_development',
    content:
      "Reading and writing skill development is treated as integral to Natural Sciences and Technology itself, not a separate subject's job: learners are required to read and write genres including instructions, reports and explanations regularly within science lessons, because their literacy skills are still developing and are critical to both learning content and being assessed on it.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_NS_AND_TECH_IP_GRADES_4_6_EDITED2,
      documentVersion: 'caps-current',
      clause: '2.7 Developing Language Skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'direct_age_appropriateness_statement',
    content:
      "The document states directly: 'The forms of assessment used should be appropriate for learners' age and developmental level' - an explicit, general age-appropriateness requirement governing all History and Geography assessment design in the phase, not tied to one topic.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '4.3.1 Formal assessment requirements',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'cognitive_load_design_rationale',
    content:
      "The document explicitly states that some NCS History topics were removed from this curriculum specifically because they were 'too cognitively demanding for the level' - curriculum content was actively cut based on a cognitive-load judgment about what this age group can handle, not only for time or relevance reasons.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '3.2 Rationale for selection of History content',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-9',
    subject: 'Social Sciences',
    clauseType: 'graduated_question_complexity',
    content:
      "Learners are encouraged to ask a specific escalating set of questions - Who? Where? What? Why? When? How? Should? Could? Is/Are? - with the hypothetical/conditional 'If?' question explicitly deferred until learners 'reach the Senior Phase,' treating conditional reasoning as a later-developing cognitive skill not expected in Grades 4-6.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Social Sciences?',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'grade_scaled_writing_expectation',
    content:
      "Writing is explicitly expected to show 'a clear progression in length and complexity through the grades,' with CAPS language documents specifying exact requirement levels per grade to be consulted throughout - writing demand is calibrated rather than uniform across Grades 4-6.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Social Sciences?',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Social Sciences',
    clauseType: 'readiness_paced_skill_introduction',
    content:
      "Mapping skills are deliberately introduced gradually: the Term 1 map-related activity is framed as 'a simple introduction' that should focus only on identifying and drawing a sequence of features, explicitly 'not on accuracy of mapping' - systematic mapping skill-building is reserved for Term 2, so precision is not demanded before the concept itself is established.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1 Geography, Landmarks and explaining the way',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Social Sciences',
    clauseType: 'concept_before_terminology',
    content:
      "Learners are expected to include primary, secondary and tertiary examples of human activities, but the document explicitly states 'there is no need to introduce this terminology at this level' - functional understanding of the categories is required without the formal classification vocabulary, mirroring the same concept-before-terminology pattern seen in Mathematics.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 1 Geography, People and places',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4',
    subject: 'Social Sciences',
    clauseType: 'cross_subject_scope_boundary',
    content:
      "A note explicitly excludes food groups and balanced diets from this Geography topic because 'these are included in curricula for Life Skills and Natural Science and Technology' - content boundaries are deliberately coordinated across subjects at this age to avoid redundant or conflicting coverage of the same concept.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 4 Term 3 Geography, People and food',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '5',
    subject: 'Social Sciences',
    clauseType: 'equity_based_differentiation',
    content:
      'For an independent weather-observation project, learners with access to measuring instruments (thermometer, rain gauge) should use them and record findings on graphs, while learners without such access should give descriptive observations instead (e.g. hot, cold, cloudy) - the task is explicitly designed so resource inequality does not exclude any learner from full participation, and a symbol-drawing option on a daily calendar is recommended for all learners regardless of access.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 5 Term 3 Geography, Observing and recording the weather',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'explicit_skill_gap_scaffolding',
    content:
      "The document explicitly names extended writing as a known difficulty at this age: 'Learners often experience difficulty in writing at length and in essay format.' The response is not to avoid extended writing but to train learners in the constituent sub-skills separately - selecting relevant information, arranging it in order, and connecting it into a logical sequence - before expecting a full extended piece.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '4.1 Guidelines for good assessment practices',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Social Sciences',
    clauseType: 'grade_gated_writing_ceiling',
    content:
      "Formal writing tasks are capped at paragraph level through the Intermediate Phase; the option to sequence paragraphs into extended passages of connected writing is explicitly introduced only 'from Grade 7' - a stated ceiling on writing complexity for Grades 4-6 that lifts at the start of Senior Phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_SOCIAL_SCIENCES_WEB,
      documentVersion: 'caps-current',
      clause: '4.3.2 Types of formal assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'process_over_product',
    content:
      "The focus of Creative Arts learning is explicitly stated to be skill development through enjoyable, experiential processes rather than working toward highly polished products each term; classroom performances of short examples should happen in a non-threatening environment where every learner's contribution is valued and acknowledged.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Life Skills? (Creative Arts)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'scope_limit_with_redirect',
    content:
      "Because integrated arts practice makes it difficult to develop specialised skills within the classroom's allocated time, learners who want to specialise in a particular instrument or dance form are explicitly directed toward extra-mural classes rather than expecting the curriculum itself to provide that depth.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Life Skills? (Performing Arts)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'graduated_sensitivity_sequencing',
    content:
      'HIV and AIDS education is deliberately staged in complexity and emotional weight across the phase: Grade 4 covers only basic facts and blood transmission; Grade 5 moves to dealing with stigma and changing attitudes; Grade 6 covers myths, realities, risk perceptions and caring for people with AIDS - each grade builds on the conceptual and emotional groundwork of the one before rather than introducing the full topic at once.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Personal and Social Well-being, Health topics (all terms/grades)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '5-6',
    subject: 'Life Skills',
    clauseType: 'graded_introduction_of_sensitive_topics',
    content:
      "Sensitive social topics are introduced at specific grades rather than frontloaded: child abuse, discrimination/stereotype/bias, and dealing with violent situations first appear in Grade 5, while gender stereotyping, sexism and abuse first appear in Grade 6 - Grade 4 Social responsibility content stays limited to children's rights, culture and religion.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Personal and Social Well-being, Social responsibility topics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'escalating_cognitive_demand_same_activity',
    content:
      "The same recurring 'weekly reading' activity is given an explicitly escalating cognitive descriptor by grade: Grade 4 is framed as 'reading for enjoyment'; Grade 5 as 'reading with understanding and using a dictionary: recall and relate'; Grade 6 as 'reading with understanding and fluency: interpret/explain and relate what has been studied' - the underlying activity stays constant while the expected depth of engagement rises each year.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause:
        'Personal and Social Well-being, Weekly reading by learners (recurring activity)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Life Skills',
    clauseType: 'escalating_cognitive_demand_same_activity',
    content:
      "Visual Literacy's culminating instruction escalates by grade on the same underlying skill: Grade 4 asks learners to 'apply learning to own work'; Grade 5 to 'apply and identify in own work'; Grade 6 to 'apply, identify and personally interpret in own work' - each year adds a cognitive layer (application, then identification, then personal interpretation) onto the same visual-analysis task.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Creative Arts, Visual Literacy topic (recurring across grades)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '6',
    subject: 'Life Skills',
    clauseType: 'puberty_timed_at_grade_level',
    content:
      "The topic of positive self-esteem and body image - explicitly covering 'understanding and respecting body changes' and outside influences on body image (media and society) - is introduced specifically in Grade 6, not earlier in the Intermediate Phase, timed to approaching adolescence rather than placed uniformly across Grades 4-6.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_IP_LIFE_SKILLS_GR_4_6_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 6 Term 1, Development of the self',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'phase_to_phase_continuity',
    content:
      "The Intermediate Phase subject is deliberately organised to ensure continuity with the foundational skills, knowledge and values of early childhood development taught in Grades R-3, rather than starting the subject's logic fresh at Grade 4.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '2.1 What is Coding and Robotics?',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'curiosity_driven_environment',
    content:
      'Teachers are explicitly instructed to create an environment that allows learners to tap into their curiosity about digital technology, supporting their creativity, responsibility, and growing confidence in using technology - the same curiosity-first framing used in the Foundation Phase version of this subject.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '2.5 Teaching Coding and Robotics in Intermediate Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'explicit_developmental_progression',
    content:
      'As learners progress through the phase, they are explicitly expected to demonstrate increasing accuracy and skill, better organisation, and safer working practices in their design and making work - progression is framed as growth in execution quality and safety awareness, not only growth in content covered.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '2.5.1 Engineering Design Process (IDMEC)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'grade_scaled_communication_expectation',
    content:
      'Learner presentations of their work are explicitly expected to show increasing use of media, levels of formality, and conventions as learners progress through the phase - communication sophistication is treated as something that develops across Grades 4-6, not a fixed standard applied uniformly.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '2.5.1 Engineering Design Process (IDMEC)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'progression_vs_integration_distinction',
    content:
      "The document explicitly distinguishes two reasons a topic's visibility changes across grades: some topics continue from Grade 4 to 6, showing progression and increasing complexity year to year, while others cease at some stage - explicitly not because the topic's importance diminishes, but because it becomes integrated into other topics rather than taught standalone.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '3.1 Overview of Topics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'concept_layering_evidence',
    content:
      "Logical-control concepts are layered in a fixed order across the phase: Grade 4 introduces only basic variables, joining/asking, and simple 'if then'; Grade 5 adds 'if then else', hiding/showing variables, and randomness; Grade 6 adds AND/OR operators and nested if statements. Each grade's new logic explicitly builds on blocks already mastered in the prior grade rather than being introduced independently.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '3.1-3.2 Algorithms and Coding strand, observed across grades',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'concept_layering_evidence',
    content:
      "Robotics hardware complexity is staged by grade to match growing dexterity and abstraction ability: Grade 4 covers output-only devices (LEDs, buzzers) via microcontrollers; Grade 5 adds wired digital inputs (buttons, keypads) and DC motors; Grade 6 adds environmental sensor inputs (thermal, light, humidity, motion) that must be combined with the outputs and motors learned earlier - each grade's hardware scope depends on skills already established.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '3.1-3.2 Robotics strand, observed across grades',
      ratifiedBy: null,
    },
  },
  {
    phase: 'INTERMEDIATE',
    gradeRange: '4-6',
    subject: 'Coding and Robotics',
    clauseType: 'concept_layering_evidence',
    content:
      'Spreadsheet formula complexity mirrors typical numeracy development: addition and subtraction formulas are introduced in Grade 4, multiplication and division formulas only in Grade 5, and more advanced functions (filter, sort, sum/average/max/min/round) only in Grade 6 - formula difficulty in this digital-skills subject is explicitly paced to track the same operation-difficulty order used in Mathematics.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_GRADE4_6_CODING_AND_ROBOTICS_DRAFT_CAPS_FINAL_19MARCH2021,
      documentVersion: 'draft-2021',
      clause: '3.1-3.2 Application Skills strand, observed across grades',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'persisting_readiness_gap',
    content:
      'The same proficiency gap noted at the start of Senior Phase is explicitly acknowledged as continuing to affect this phase: learners should be reasonably proficient in their First Additional Language by now, but the document states plainly that many still cannot communicate well in it, so the phase must simultaneously support learners below the expected level while still preparing all learners for the higher-proficiency standards required afterward.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.1 Language levels',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'explicit_cognitive_ceiling',
    content:
      "The document explicitly states that literary interpretation 'is essentially a university level activity, and learners in this phase do not have to learn this advanced level of interpretation' - the purpose of teaching literary texts here is narrower: showing learners how language can be used with subtlety, intelligence, imagination and flair, not producing full academic literary criticism.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.3 Approaches to teaching literature',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'attention_paced_reading',
    content:
      "Reading a text in class should be completed within about two weeks and without breaking for other activities, because 'spending too long on reading a text is deleterious to a clear understanding of narrative line and plot' - pacing guidance is explicitly tied to preserving comprehension rather than covering content exhaustively. The document also notes 'poetry should be taught, not poems' - implying breadth of exposure over isolated close study.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.3 Approaches to teaching literature',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'psychological_safety_for_oral_work',
    content:
      "Learners must be assured there will be 'no mockery or ridicule' when they speak, with full teacher support and encouragement at all times; the document explicitly states that building this self-confidence is more important than any specific public-speaking technique, and recommends 'a degree of tolerance' toward learners given the demands oral interaction makes on them at this age.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '3.1.1 Speaking',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'quantified_grade_benchmarks',
    content:
      'Listening comprehension text length scales explicitly by grade: longer texts (stories, interviews, plays) run 130-180 words in Grade 7, 180-200 in Grade 8, and 200-220 in Grade 9 (each up to 5 minutes); reading comprehension texts run 130-180 words (Gr7) to 230-280 words (Gr9) - continuing the same kind of quantified word-count escalation seen in earlier phases, now recalibrated for Senior Phase levels.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '3.1.1 Length of texts for listening comprehension',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'quantified_grade_benchmarks',
    content:
      'Prescribed literary text volume is explicitly scaled by grade: poetry moves from 5-8 poems (Gr7) to 8-10 (Gr8) to 10-12 (Gr9); novels from 30-40 pages (Gr7) to 40-50 (Gr8) to 50-60 (Gr9); short stories and folklore from 4-5 stories (Gr7) to 7-10 (Gr9); drama from a 1-2 act play (Gr7) to a 3-5 act play (Gr9) - a concrete, quantified reading-load ladder across the three grades.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '3.1.2 Texts used for the integrated teaching of language skills',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'First Additional Language',
    clauseType: 'scaffolding_removal_threshold',
    content:
      "The document marks an explicit readiness threshold at the start of Senior Phase: 'In the previous phases, learners learnt to write a range of creative and informational texts, using writing frames as support. Learners in the Senior Phase are expected to write particular text types independently.' Writing frames remain available 'as and when necessary' rather than being banned outright, but independent writing becomes the phase's default expectation rather than the scaffolded approach used before Grade 7.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_FAL_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '3.1.3 Writing and Presenting',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Home Language',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_HOME_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Home Language',
    clauseType: 'grade_boundary_skill_weighting_shift',
    content:
      'The document explicitly states that from Grade 7 onwards, the emphasis and weighting for Listening and Speaking are deliberately lower than for Reading and Writing skills - a stated shift in curriculum time balance timed to this specific grade boundary, moving weight toward literacy skills as learners enter Senior Phase.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_HOME_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1.1 Language levels',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Home Language',
    clauseType: 'quantified_HL_vs_FAL_time_gap',
    content:
      'The Language of Learning and Teaching (typically Home Language) receives more weekly instructional time per two-week cycle than another compulsory (First Additional) language at the same grade: 3 hours 30 minutes for Reading and Viewing versus 3 hours, and 3 hours 30 minutes for Writing and Presenting versus 2 hours - a concrete, quantified time-allocation gap reflecting the differential language load between the two levels even though both are taught in the same grades.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_HOME_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.2 Time allocation for the Home Language',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Home Language',
    clauseType: 'quantified_HL_above_FAL_benchmarks',
    content:
      'Home Language listening and reading comprehension text-length targets are set higher than the parallel First Additional Language targets at the same grade: Grade 7 longer listening texts run 150-200 words for Home Language versus 130-180 for FAL; Grade 9 reading comprehension texts run 250-300 words for Home Language versus 230-280 for FAL - continuing the same differential-load pattern seen between Home Language and First Additional Language benchmarks in earlier phases, now quantified for Senior Phase.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_HOME_ENGLISH_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '3.1.1 Length of texts for listening comprehension',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'quantified_weighting_reallocation',
    content:
      'Content-area weighting shifts on a fixed trajectory across the three grades: Numbers, Operations and Relationships drops from 30% (Gr7) to 25% (Gr8) to 15% (Gr9), while Patterns, Functions and Algebra rises from 25% to 30% to 35%, and Space and Shape rises from 25% to 30%. The declining weight on basic number work and rising weight on abstract algebra and geometry is a deliberate, quantified reallocation of curriculum time as learners mature.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '2.6 Weighting of content areas',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'named_conceptual_development_stages',
    content:
      "Learners' conceptual development in this content area is explicitly staged: from an understanding of number to an understanding of variables in generalised form; from recognising patterns and relationships to recognising functions with unique input-output correspondence; and from viewing Mathematics as memorised, separate facts to seeing it as interrelated concepts expressible in equivalent forms (a pattern, an equation, a graph representing the same relationship).",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Specification of Content phase overview, Patterns Functions and Algebra',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'named_cognitive_shift',
    content:
      'Progression in geometry across the phase is explicitly described as developing from informal descriptions of geometric figures to more formal definitions and classification, and from inductive reasoning to deductive reasoning - naming a specific, well-established cognitive development shift (inductive to deductive) as the organising principle for how geometry content is sequenced Grade 7 to 9.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Specification of Content phase overview, Space and Shape (Geometry)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'phase_to_phase_foundation_laying',
    content:
      "Transformation geometry is explicitly described as developing from general descriptions of movement in space to more specific descriptions of movement in coordinate planes over the course of the Senior Phase, stated as laying the foundation for analytic geometry in the FET phase (Grades 10-12) - an explicit statement that current-phase sequencing is designed around a later phase's readiness needs.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Specification of Content phase overview, Space and Shape (Geometry)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'critical_thinking_maturation',
    content:
      "Data Handling progression is explicitly framed as including learners 'becoming more critical and aware of bias and manipulation in representing, analysing and reporting data' and being 'sensitised to bias in the collection of data, as well as misrepresentation of data through the use of different scales and different measures of central tendency' - the content area is treated as building critical-thinking maturity alongside technical statistical skill as learners progress through the phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Specification of Content phase overview, Data Handling',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Mathematics',
    clauseType: 'systematic_not_random_practice',
    content:
      "Mental calculation practice is explicitly required to be systematic rather than arbitrary: 'Learners should not be asked to do random calculations each day. Rather, mental calculations should be used as an opportunity to consolidate four aspects of learners' number knowledge' (number facts, calculation techniques, number concept, and properties of numbers) - the same systematic-not-random mental-maths principle found in the Intermediate Phase document, confirmed to continue into Senior Phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Whole numbers clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Mathematics',
    clauseType: 'grade_transition_consolidation',
    content:
      "Every topic's clarification notes open with a 'What is different to Grade [previous]?' callout isolating exactly what content is new, continuing the same structural mechanism for checking prior-grade mastery before extending it that was found in the Intermediate Phase Mathematics document - confirming this design convention spans both phases.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Recurring across Grade 7-9 term clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Mathematics',
    clauseType: 'explicit_deferral_to_named_grade',
    content:
      "The document explicitly defers a specific rule within Grade 7 itself: 'At this point, learners do not need to know the rule for raising a number to the power 0. This will only be introduced in Grade 8 when they use other laws of exponents in calculations' - a precise, named example of content being gated to a specific later grade rather than a vague 'later' deferral.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Exponents clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Mathematics',
    clauseType: 'explicit_scope_ceiling',
    content:
      "In financial-context problem solving, Grade 7 learners are explicitly stated as 'not expected to use formulae for calculating simple interest' - functional problem-solving is expected without the formal formula, which appears without this restriction in the Grade 8-9 content, mirroring the concept-before-formalism pattern seen elsewhere in CAPS Mathematics.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Whole numbers clarification notes (Solving problems)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Mathematics',
    clauseType: 'scaffolded_skill_release',
    content:
      "Geometric construction skills are explicitly introduced with a guided-then-independent sequence: 'Initially, learners have to be given careful instructions about how to do the constructions of the various shapes... Once they are comfortable with the apparatus and can do the constructions, they can practise by drawing patterns' - direct instruction is expected to precede independent creative application, not the reverse.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_MATHEMATICS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Construction of geometric figures clarification notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Natural Science',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Natural Science',
    clauseType: 'strand_progression',
    content:
      'Each of the four Knowledge Strands (Life and Living, Matter and Materials, Energy and Change, Planet Earth and Beyond) is deliberately developed progressively across the three years of Senior Phase, with links between strands required to be made progressively across grades rather than taught as isolated, self-contained units each year.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.4 Organisation of the Natural Sciences Curriculum',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Natural Science',
    clauseType: 'developmentally_appropriate_values',
    content:
      'Investigative skill-building is explicitly paired with values suited to this age: learners should not damage plants, and if they examine small animals they must care for them and release them where they were found - the same respect-for-living-things principle found in the Intermediate Phase document, confirmed to continue unchanged into Senior Phase.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: "2.6 Specific Aim 1: 'Doing Science'",
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Natural Science',
    clauseType: 'safety_constrained_group_size',
    content:
      'For safety and educational reasons, no more than three learners should share investigation space and equipment - the identical group-size ceiling used in the Intermediate Phase Natural Sciences and Technology document, confirming this is a stable safety standard across both phases rather than being loosened as learners get older.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.8 Resources',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Natural Science',
    clauseType: 'experience_over_equipment_priority',
    content:
      'It is explicitly stated as more important for learners to have the experience of carrying out varied investigations than to depend on ideal equipment availability; where equipment is genuinely limited, teachers should improvise, and where there is no alternative, a teacher demonstration is preferred over skipping the investigation entirely - identical wording and priority to the Intermediate Phase document.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.8 Resources',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Natural Science',
    clauseType: 'sensitive_topic_framing',
    content:
      "Human reproduction content is explicitly framed around decision-making rather than biology alone: 'It is important that learners understand that early sexual activity can have serious consequences. Learners need to know enough about this topic to be able to make informed decisions and responsible choices' - the stated purpose of teaching the content is behavioural and protective, not purely descriptive, appropriate to learners entering puberty at this grade.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Sexual reproduction - Human Reproduction',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-8',
    subject: 'Natural Science',
    clauseType: 'explicit_scope_ceiling',
    content:
      "Content notes repeatedly cap depth per grade with explicit bracketed instructions: classification of all invertebrates is 'not required' in Grade 7 biodiversity; the definition and calculation of joules is 'NOT required' when introducing potential/kinetic energy; photosynthesis and respiration equations state 'No further details are required'; and a sub-aspect of gas pressure related to heating is flagged as something 'we do not have to deal with... in this grade.' These recurring ceilings are a deliberate design feature limiting depth to what is developmentally appropriate for the grade.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Recurring across Grade 7-8 content notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Natural Science',
    clauseType: 'examples_before_formal_definition',
    content:
      "Teachers are explicitly instructed that the 'approach should be to provide learners with examples rather than a definition' when introducing the law of conservation of energy - concrete examples are prioritised over abstract formal statements at this stage, consistent with a concept-before-formalism pattern seen elsewhere in CAPS science and mathematics documents.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 3, Law of conservation of energy',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '8',
    subject: 'Natural Science',
    clauseType: 'concept_over_rote_memorisation',
    content:
      "When teaching how friction transfers charge between materials, the document explicitly notes 'Learners do not need to memorise what charge the materials acquire when rubbed together' - conceptual understanding of the transfer mechanism is required, but rote memorisation of specific material-charge pairings is explicitly not expected.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_NATURAL_SCIENCES_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 8 Term 3, Static electricity',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Social Science',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Social Science',
    clauseType: 'explicit_skill_gate_by_grade',
    content:
      "Learners are explicitly 'not expected to work with 1: 50 000 topographical maps or orthophoto maps' in Grade 7 - these more complex map types are deliberately withheld until Grade 9, where the corresponding topic notes confirm 'Topographic and orthophoto maps are introduced in Grade 9,' with Grade 8 using only photographs and simplified shaded maps as an intermediate step.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1 Geography, Map skills notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-8',
    subject: 'Social Science',
    clauseType: 'explicit_scope_ceiling_deferred_to_FET',
    content:
      "Several sub-topics are explicitly excluded with content deferred to the FET phase (Grades 10-12): faulting is noted as 'included in the FET Geography curriculum. There is no need to include detail here'; tropical cyclones and other meteorological phenomena are stated as 'not necessary to study... at this level'; and land-use models are flagged as 'not required at this level' in Grade 8, with the focus narrowed to characteristics of land-use zones only.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Recurring Geography term notes (e.g. Volcanoes/Earthquakes, Settlement)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '8',
    subject: 'Social Science',
    clauseType: 'cross_subject_readiness_check',
    content:
      "Before starting the Grade 8 'Maps and globes' topic, teachers are explicitly instructed to 'check learners' knowledge of earth's place in the solar system (Natural Sciences)' - readiness for this Geography topic is deliberately tied to and verified against content taught in a different subject in the same grade.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 8 Term 1 Geography, Maps and globes notes',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '6-7',
    subject: 'Social Science',
    clauseType: 'terminology_introduced_at_phase_boundary',
    content:
      "The document explicitly notes that the term 'sources' is deliberately withheld through Grades 4-6, where the same concept is taught under the plainer phrase 'how we find information about the past'; the formal term 'sources' is introduced specifically starting in Grade 7, the first year of Senior Phase - a precise, named example of formal vocabulary being timed to a phase transition rather than introduced with the underlying concept.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1 History, background note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Social Science',
    clauseType: 'emotionally_graduated_topic_sequencing',
    content:
      "Historically and emotionally weighty topics are sequenced with increasing proximity to learners' own national identity as the phase progresses: Grade 7 covers distant African and colonial-era history (the Mali kingdom, the transatlantic slave trade, Cape colonisation); Grade 8 covers 19th-20th century industrial and colonial history (the Mineral Revolution, the Scramble for Africa, WWI); Grade 9 - the final and most mature Senior Phase year - is where apartheid, racism, and South Africa's own turning points (1948, Sharpeville, Soweto, 1994) are directly taught, paired with explicit content on why 'race' is a social construct rather than biological fact.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'History content overview, Grades 7-9',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-8',
    subject: 'Social Science',
    clauseType: 'project_pacing_principle',
    content:
      "Independent-study projects are explicitly bounded in classroom-time impact: teachers are told to 'introduce this project early in the term for submission late in the term' and that it 'should not absorb much formal classroom time,' with only limited time set aside for explaining and monitoring progress - project work is designed to run alongside regular teaching, not to replace it.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_SOCIAL_SCIENCE_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 7-8 project notes (Geography and History)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'graduated_curriculum_prescriptiveness',
    content:
      "The degree of curriculum prescriptiveness is explicitly reduced as learners mature through the phase: the Grade 7 curriculum is 'described very specifically to ensure that all learners cover the same work in all schools,' Grade 8 gives textbook authors much more freedom in some sections, and Grade 9 content is deliberately 'non-specific' because Grade 9 learners must be able to identify a problem, need or opportunity from an open-ended real-life context themselves - autonomy in defining the task is treated as a capability that develops across the phase, not one learners start with.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '2.8 Requirements for Technology',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-8',
    subject: 'Technology',
    clauseType: 'qualitative_before_quantitative_gating',
    content:
      "Lever mechanics is introduced with a 'simple quantitative treatment - no calculations using moments' in Grade 7, and even by Grade 8 when mechanical advantage calculations are introduced, teachers are told to 'Do NOT use the method of taking moments about a point' - full moment-based calculation is withheld well beyond its conceptual introduction, consistent with a concept-before-full-formalism pattern found elsewhere in CAPS.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause:
        'Grade 7 Term 1 Mechanical Systems; Grade 8 Term 3 Mechanical Advantage calculations',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '8-9',
    subject: 'Technology',
    clauseType: 'qualitative_before_quantitative_gating',
    content:
      "Ohm's Law is explicitly introduced 'qualitatively - no calculations' in Grade 8, where learners only observe that adding more cells increases current strength; the quantitative form with actual R=V/I calculations is deferred to Grade 9 Term 3 - a clearly evidenced two-step progression from qualitative relationship to quantitative formula across grades.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 8 Term 4 Electrical Systems; Grade 9 Term 3 Electrical Systems',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Technology',
    clauseType: 'explicit_scope_ceiling',
    content:
      "The document explicitly states 'Learners will not be expected to design an electronic circuit. They will assemble and connect the components of a given circuit and will design a suitable application for that circuit' - functional application of a pre-built circuit is required, while full circuit design remains outside the scope of Grade 9.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 9 Term 3, Electronic Systems and Control',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'motivation_and_inclusive_differentiation',
    content:
      "The document explicitly links hands-on making to psychological benefit: 'Personal involvement by learners with tasks often improves their attention span, patience, persistence and commitment' and 'Designing and making real products that can be used can give learners a sense of achievement and improve their self-esteem.' It also lists concrete inclusive-differentiation strategies for learners with barriers to learning - more time, enlarged text, ICT support, amanuensis/scribes, shorter focused tasks for incremental success, and non-written communication methods (modelling, role-play, video) - while stressing learners must retain control of design decisions even when assisted.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.2 Barriers to learning and assessing',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'readiness_staging_before_formal_assessment',
    content:
      "Enabling tasks that precede each term's formal Mini-PAT are explicitly described as building 'the knowledge, skills and values to the point where the learners are ready to be assessed formally,' with the document drawing a direct analogy to 'the \"learner\" stage preceding the driver's licence test' - formal assessment is only appropriate once a deliberate practice-and-readiness stage has been completed, not from day one of a new topic.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.3 Informal daily assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'direct_age_appropriateness_statement',
    content:
      "The document states directly: 'The forms of assessment used should vary and be age- and developmental level-appropriate' - the same explicit age-appropriateness assessment requirement found in the Social Sciences Senior Phase document, confirming it as a cross-subject DBE assessment design principle rather than a one-off statement.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.3.1 Formal assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Technology',
    clauseType: 'experience_based_not_age_based_difficulty',
    content:
      "The document explicitly adopts Plant's Problem Solving Taxonomy because in that model 'the cognitive level is determined by previous experience of learners,' which it states 'fits well with the skills development in Technology where learners are expected to get progressively better through the year' - task difficulty is explicitly calibrated to accumulated experience rather than age or grade alone, a more nuanced readiness framework than pure calendar-based sequencing.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_TECHNOLOGY_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.3.2 Mini-PAT, Problem Solving Taxonomy note',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Economic Management Sciences',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Economic Management Sciences',
    clauseType: 'direct_age_appropriateness_statement',
    content:
      "The document states directly, for both the Grade 7 and the Grade 8-9 end-of-year examination formats: 'Information provided in the texts for case studies and scenarios must be relevant, current, age-appropriate and learner-friendly' - an explicit age-appropriateness requirement specifically targeting the real-world material used in formal assessment scenarios, not just the underlying subject content.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.3.2(b) Tests and examinations',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Economic Management Sciences',
    clauseType: 'grade_gated_abstraction_ladder',
    content:
      'Financial literacy content is deliberately staged in abstraction across the phase: Grade 7 covers only personal-level concepts (income, expenses, personal budgets, savings) with no formal bookkeeping; Grade 8 introduces the full formal double-entry accounting cycle for the first time (accounting concepts, Cash Receipts/Payments Journals, General Ledger, Trial Balance); Grade 9 extends this to credit-based transactions (Debtors Journal, Creditors Journal, Debtors/Creditors Ledgers) - each grade adds a layer of formal accounting complexity onto the one before, and one hour per week is specifically reserved for this formal accounting strand only from Grade 8 onward.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '2.3 Time allocation; Section 3 Annual Teaching Plan',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Economic Management Sciences',
    clauseType: 'capstone_complexity_placement',
    content:
      'The most mathematically and conceptually demanding financial content - break-even points, mark-up on sales, and profit percentage calculations within a full business plan - is placed as the final topic of the final term of the final Senior Phase year, functioning as a capstone that draws on everything built up across the three grades rather than being introduced earlier.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9,
      documentVersion: 'caps-current',
      clause: 'Grade 9 Term 4, Business plan',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Economic Management Sciences',
    clauseType: 'phase_exit_stakes_escalation',
    content:
      'The end-of-year examination for Grades 7 and 8 is set, marked and moderated entirely internally, but the Grade 9 end-of-year examination is set externally (with internal marking and moderation) - Grade 9, as the exit point of the GET band before FET subject choices, carries a higher-stakes, more standardised assessment than the two grades before it.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_EMS_GR_7_9,
      documentVersion: 'caps-current',
      clause: '4.6.1 Moderation of assessment',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Creative Arts',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Creative Arts',
    clauseType: 'direct_age_appropriateness_statement',
    content:
      "The document states directly: 'Progression in the visual arts is both cyclical and linear. Teaching should be age appropriate and sensitive to the development of genuine creativity' - an explicit age-appropriateness requirement specific to how Visual Arts teaching should be paced and pitched.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Creative Arts? (Visual Arts)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Creative Arts',
    clauseType: 'itemized_progression_model',
    content:
      "The whole subject's progression model is spelled out explicitly: because arts learning is both circular and linear, the same topics repeat each year with increasing complexity, and the nature of that progression consists specifically of introducing new concepts and skills, increasing vocabulary in the art form, increasing the ability to listen well and work with others, increasing skill in the art form itself, and increasing confidence, self-discipline, focus and creativity - a named, itemised model of what 'getting harder' actually means in this subject.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.3 Rationale for the organisation of content',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Creative Arts',
    clauseType: 'sustained_practice_over_cramming',
    content:
      "The two selected art forms must be taught throughout the year rather than in half-year blocks, because building physical and artistic skill 'takes a long time and requires regular practice' - continuity of practice at least twice per week is explicitly stated as necessary to build skill, and this applies especially to learners aiming for arts subjects in FET; the curriculum design deliberately avoids concentrated, crammed blocks of arts instruction.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.3 Time allocation, Timetabling for the Senior Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Creative Arts',
    clauseType: 'equity_protection_for_late_starters',
    content:
      "While it is stated as preferable for learners to begin specialising in an art form as early as possible, the document explicitly protects late starters: 'learners with potential who have not had access to an art form in Grade 7 and who wish to select it in Grade 8 or 9, should not be excluded' - prior unequal access to an art form is not allowed to permanently close off a pathway.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.3 Learner pathway selection',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '8-9',
    subject: 'Creative Arts',
    clauseType: 'scaffolding_removal_by_grade',
    content:
      "Planning and preparation for final art projects is explicitly scaffolded then released: in Grade 8, learners 'with guidance, collect resources, visual information and preliminary drawings and sketches in preparation for the final projects'; the identical Grade 9 descriptor states planning and preparation are 'same as before but works independently' - a clean, single-word-change example of guided support being withdrawn at a specific grade boundary.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.4.4 Visual Arts, Topic 3 Visual literacy',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Creative Arts',
    clauseType: 'phase_exit_readiness_target',
    content:
      'For learners wishing to continue Music into FET, the document sets a specific exit-of-phase target: they should be able to perform instrumentally or vocally at an elementary level with a good sense of rhythm and pitch, and should also be able to read staff notation by the end of Grade 9 - an explicit readiness benchmark tied to the Senior Phase exit point, not an open-ended aspiration.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Creative Arts? (Music)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Creative Arts',
    clauseType: 'sensitive_cultural_content_framing',
    content:
      "When Grade 9 drama explores cultural practices including wedding ceremonies, christenings, initiation rites and coming-of-age ceremonies, teachers are explicitly instructed to 'explore the cultural context with sensitivity and respect towards different cultures and cultural practices' - the most personally and culturally sensitive dramatic content in the phase is paired with an explicit sensitivity instruction and placed in the final Senior Phase year.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Drama in Grade 9, Term 1, Drama elements in playmaking',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '9',
    subject: 'Creative Arts',
    clauseType: 'critical_social_analysis_reserved_for_final_year',
    content:
      "Analysis of stereotyping by age, gender, class/status and culture, and explicit 'exploration of how discrimination and prejudice are linked with stereotyping,' is introduced specifically in Grade 9 - the same pattern of reserving critical social-justice analysis for the final, most cognitively mature Senior Phase year seen in the Social Sciences document's treatment of apartheid and racism.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_CREATIVE_ARTS_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Drama in Grade 9, Term 2, Media',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Life Orientation',
    clauseType: 'progression',
    content:
      'Content and context of each grade shows progression from simple to complex - the shared core sequencing principle applied across every CAPS subject.',
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '1.3(c) General Principles',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Life Orientation',
    clauseType: 'cross_phase_continuity',
    content:
      "The document explicitly states that Senior Phase Life Orientation topics relate directly to those in the Foundation and Intermediate Phases and to Grades 10-12, and that 'the content taught in lower grades serves as the foundation for the content to be taught in higher grades' - continuity is stated as spanning the entire schooling system, not just within the phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.1 What is Life Orientation?',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Life Orientation',
    clauseType: 'quantified_topic_weighting_shift',
    content:
      "Within the fixed 70 contact hours per grade, 'World of Work' content hours rise across the phase - 8 hours (Grade 7) to 9 hours (Grade 8) to 11 hours (Grade 9) - while Physical Education holds a constant 35 hours in every grade; career and work-readiness content is deliberately weighted more heavily as learners approach the Grade 9 exit point and FET subject choices.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: '2.4 Weighting of topics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Life Orientation',
    clauseType: 'puberty_content_timed_to_phase_entry',
    content:
      "Puberty and body-change content ('Changes in boys and girls: puberty and gender constructs,' physical and emotional changes, and 'respect for own and others' body changes and emotions') is placed early in Term 1 of Grade 7, the very start of Senior Phase - timed to coincide with when this content is most actively relevant to learners physically entering the phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Development of the self in society',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Life Orientation',
    clauseType: 'protective_coping_framing',
    content:
      "Peer pressure content is framed protectively rather than just descriptively: it covers how peer pressure can lead to substance use, crime, unhealthy sexual behaviour, bullying and rebellious behaviour, paired explicitly with 'appropriate responses to pressure: assertiveness and coping skills,' negotiation skills for disagreeing constructively, and 'where to find help' - the topic is taught with built-in protective skills and help-seeking pathways, not left as description alone.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 1, Development of the self in society (Peer pressure)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Life Orientation',
    clauseType: 'preventive_not_just_descriptive_framing',
    content:
      "Substance abuse content is explicitly structured around prevention rather than mere facts: types and symptoms are covered alongside 'personal factors that contribute to substance abuse,' 'protective factors that reduce the likelihood of substance abuse,' and 'prevention measures: early detection' - the topic's stated purpose is risk reduction, introduced in Grade 7, the first year of Senior Phase.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 3, Health, social and environmental responsibility',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7',
    subject: 'Life Orientation',
    clauseType: 'care_and_support_framing',
    content:
      "Common disease content (tuberculosis, diabetes, epilepsy, obesity, anorexia, HIV and AIDS) is framed around living with the condition rather than just naming it: causes are covered alongside 'treatment options, care and support,' resources for health information and services, and explicit 'strategies for living with tuberculosis, diabetes, epilepsy, HIV and AIDS' - continuing the graduated, support-oriented approach to serious health topics seen in earlier phases, now broadened to include additional conditions.",
    source: {
      documentId: DOC_AGE_APPROPRIATENESS_SRC_CAPS_SP_LIFE_ORIENTATION_GR_7_9_WEB,
      documentVersion: 'caps-current',
      clause: 'Grade 7 Term 4, Health, social and environmental responsibility',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'phase_to_phase_reinforcement',
    content:
      "Senior Phase topics are explicitly organised 'to ensure that the concepts developed in the Intermediate Phase are reinforced in Senior Phase' - continuity across phases is framed as deliberate reinforcement of prior learning, not merely building on assumed retention.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Overview / Organisation of topics',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'scaffolded_notation_bridge',
    content:
      "Senior Phase coding shifts from the Intermediate Phase's block-based coding toward line-based (text) programming, but does so through a hybrid platform combining block-based and line-based coding rather than an abrupt switch; the line-based interface is deliberately 'easy to understand, syntax free' so that 'learners can focus on the programming concepts that are being taught' rather than fighting new syntax at the same time as new logic - a scaffolded bridge between notation systems timed to the phase transition.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Algorithms and Coding strand',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'curiosity_driven_environment',
    content:
      'Teachers are instructed to create an environment that allows learners to tap into their curiosity about digital technology, supporting their creativity, responsibility, and growing confidence in using technology - the same curiosity-first framing found in the Foundation and Intermediate Phase versions of this subject, confirmed to persist unchanged into Senior Phase.',
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Teaching Coding and Robotics in Senior Phase',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'explicit_developmental_progression',
    content:
      "As in the Intermediate Phase document and the Senior Phase Technology document, learners are explicitly expected to 'demonstrate increasing accuracy and skill, better organisation and safer working practices' as they progress, and their presentations are expected to 'show increasing use of media, levels of formality and conventions as they progress through the phase' - identical design-process pedagogy language confirmed as standardised across both design-based CAPS subjects and both phases.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Engineering Design Process (IDMEC)',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'integrated_literacy_development',
    content:
      "Reading and writing are described as central to successful learning in Coding and Robotics even though the subject itself is technical: learners must read labels, buttons, icons and interface titles, interpret written block-code examples, and construct meaningful logical explanations of their work; the document states 'the learner's ability to read and write well is critical when they are assessed both informally and formally' - the same integrated-literacy pattern found in the Natural Sciences documents, now confirmed in a digital-skills subject.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Literacy and Numeracy Skills integration',
      ratifiedBy: null,
    },
  },
  {
    phase: 'SENIOR',
    gradeRange: '7-9',
    subject: 'Coding and Robotics',
    clauseType: 'non_linear_process_flexibility',
    content:
      "Investigation is explicitly stated to be able to happen at any point in the Design Process and 'should not be something that must be completed before design begins' - the design process is deliberately non-linear rather than a fixed lockstep sequence, giving teachers flexibility in how they pace investigation relative to a learner's readiness for a given task.",
    source: {
      documentId:
        DOC_AGE_APPROPRIATENESS_SRC_DRAFT_CAPS_CODING_AND_ROBOTICS_GRADES_7_9_DEPARTMENT_OF_BASIC_EDUCATIO,
      documentVersion: 'draft-2021',
      clause: 'Engineering Design Process (IDMEC), Investigation',
      ratifiedBy: null,
    },
  },
];
