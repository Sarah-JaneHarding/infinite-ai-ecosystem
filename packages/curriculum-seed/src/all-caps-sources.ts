// Adapter: maps every CAPS source file in @infinite-ai/contracts to the common
// `CapsSourceInfo` shape expected by `submitCapsSource` and `buildCapsL0Payload`.
//
// Each CAPS source file has its own naming convention for content areas, topic
// progressions, weightings, and metadata. This file absorbs that divergence in one
// place so the rest of curriculum-seed sees a uniform array.
//
// Ground rules:
//  - contentAreas: use CONTENT_AREAS when present; otherwise STUDY_AREAS / STRANDS /
//    SKILLS / TOPICS — whatever the file treats as its primary structural divisions.
//  - weightings: populate from the file's WEIGHTINGS array (basis.clause → clause).
//    Files without a WEIGHTINGS export get an empty array.
//  - topicCount: .length of the file's primary progressions / structural array.
//  - source: SourceRef pointing back to the document itself; ratifiedBy is null until
//    a human countersigns (§ Rule 11 of CLAUDE.md).

import {
  CAPS_CA_SP_CONTENT_AREAS,
  CAPS_CA_SP_METADATA,
  CAPS_CA_SP_TOPIC_PROGRESSIONS,
  CAPS_CODING_ROBOTICS_R3_DOC_ID,
  CAPS_CODING_ROBOTICS_R3_VERSION,
  CAPS_CR_R3_METADATA,
  CAPS_CR_R3_STRANDS,
  CAPS_EMS_SP_CONTENT_AREAS,
  CAPS_EMS_SP_METADATA,
  CAPS_EMS_SP_TOPIC_PROGRESSIONS,
  CAPS_EMS_SP_WEIGHTINGS,
  CAPS_ENG_FAL_IP_CONTENT_AREAS,
  CAPS_ENG_FAL_IP_METADATA,
  CAPS_ENG_FAL_IP_TOPIC_PROGRESSIONS,
  CAPS_ENG_HL_FP_CONTENT_AREAS,
  CAPS_ENG_HL_FP_METADATA,
  CAPS_ENG_HL_FP_TOPIC_PROGRESSIONS,
  CAPS_ENG_HL_IP_CONTENT_AREAS,
  CAPS_ENG_HL_IP_METADATA,
  CAPS_ENG_HL_IP_TOPIC_PROGRESSIONS,
  CAPS_FAL_FP_CONTENT_AREAS,
  CAPS_FAL_FP_METADATA,
  CAPS_FAL_FP_TOPIC_PROGRESSIONS,
  CAPS_FAL_SP_CONTENT_AREAS,
  CAPS_FAL_SP_METADATA,
  CAPS_FAL_SP_TOPIC_PROGRESSIONS,
  CAPS_HL_SP_CONTENT_AREAS,
  CAPS_HL_SP_METADATA,
  CAPS_HL_SP_TOPIC_PROGRESSIONS,
  CAPS_IP_LIFE_SKILLS_GR46_METADATA,
  CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS,
  CAPS_ISIZULU_FAL_GR13_METADATA,
  CAPS_ISIZULU_FAL_GR13_SKILLS,
  CAPS_LIFE_SKILLS_R3_METADATA,
  CAPS_LIFE_SKILLS_R3_STUDY_AREAS,
  CAPS_LO_SP_GR79_METADATA,
  CAPS_LO_SP_GR79_TOPICS,
  CAPS_MATHS_FP_CONTENT_AREAS,
  CAPS_MATHS_FP_METADATA,
  CAPS_MATHS_FP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_FP_WEIGHTINGS,
  CAPS_MATHS_IP_CONTENT_AREAS,
  CAPS_MATHS_IP_METADATA,
  CAPS_MATHS_IP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_IP_WEIGHTINGS,
  CAPS_MATHS_SP_CONTENT_AREAS,
  CAPS_MATHS_SP_METADATA,
  CAPS_MATHS_SP_TOPIC_PROGRESSIONS,
  CAPS_MATHS_SP_WEIGHTINGS,
  CAPS_NS_SP_CONTENT_AREAS,
  CAPS_NS_SP_METADATA,
  CAPS_NS_SP_TOPIC_PROGRESSIONS,
  CAPS_NST_IP_CONTENT_AREAS,
  CAPS_NST_IP_METADATA,
  CAPS_NST_IP_TOPIC_PROGRESSIONS,
  CAPS_SS_IP_CONTENT_AREAS,
  CAPS_SS_IP_METADATA,
  CAPS_SS_IP_TOPIC_PROGRESSIONS,
  CAPS_SS_SP_CONTENT_AREAS,
  CAPS_SS_SP_METADATA,
  CAPS_SS_SP_TOPIC_PROGRESSIONS,
  CAPS_TECH_SP_CONTENT_AREAS,
  CAPS_TECH_SP_METADATA,
  CAPS_TECH_SP_TOPIC_PROGRESSIONS,
} from '@infinite-ai/contracts';

import type { CapsSourceInfo, CapsWeightingEntry } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPhase(phase: string): 'FOUNDATION' | 'INTERMEDIATE' | 'SENIOR' {
  if (phase === 'Foundation Phase' || phase === 'FOUNDATION') return 'FOUNDATION';
  if (phase === 'Intermediate Phase' || phase === 'INTERMEDIATE') return 'INTERMEDIATE';
  return 'SENIOR';
}

const PHASE_GRADES: Record<'FOUNDATION' | 'INTERMEDIATE' | 'SENIOR', readonly string[]> =
  {
    FOUNDATION: ['R', '1', '2', '3'],
    INTERMEDIATE: ['4', '5', '6'],
    SENIOR: ['7', '8', '9'],
  };

function sourceRef(documentId: string, documentVersion: string) {
  return {
    documentId,
    documentVersion,
    clause: 'CAPS curriculum source data',
    ratifiedBy: null,
  };
}

// ---------------------------------------------------------------------------
// Foundation Phase
// ---------------------------------------------------------------------------

const mathsFp: CapsSourceInfo = {
  documentId: CAPS_MATHS_FP_METADATA.documentId,
  documentVersion: CAPS_MATHS_FP_METADATA.documentVersion,
  title: CAPS_MATHS_FP_METADATA.title,
  subject: 'Mathematics',
  phase: 'FOUNDATION',
  grades: PHASE_GRADES['FOUNDATION'],
  contentAreas: [...CAPS_MATHS_FP_CONTENT_AREAS],
  weightings: CAPS_MATHS_FP_WEIGHTINGS.map((w): CapsWeightingEntry => ({
    contentArea: w.contentArea,
    grade: w.grade,
    weightingPercent: w.weightingPercent,
    clause: w.basis.clause,
  })),
  topicCount: CAPS_MATHS_FP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_MATHS_FP_METADATA.documentId,
    CAPS_MATHS_FP_METADATA.documentVersion,
  ),
};

const engHlFp: CapsSourceInfo = {
  documentId: CAPS_ENG_HL_FP_METADATA.documentId,
  documentVersion: CAPS_ENG_HL_FP_METADATA.documentVersion,
  title: CAPS_ENG_HL_FP_METADATA.title,
  subject: 'English Home Language',
  phase: 'FOUNDATION',
  grades: PHASE_GRADES['FOUNDATION'],
  contentAreas: [...CAPS_ENG_HL_FP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_ENG_HL_FP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_ENG_HL_FP_METADATA.documentId,
    CAPS_ENG_HL_FP_METADATA.documentVersion,
  ),
};

const falFp: CapsSourceInfo = {
  documentId: CAPS_FAL_FP_METADATA.documentId,
  documentVersion: CAPS_FAL_FP_METADATA.documentVersion,
  title: CAPS_FAL_FP_METADATA.title,
  subject: 'First Additional Language',
  phase: 'FOUNDATION',
  grades: PHASE_GRADES['FOUNDATION'],
  contentAreas: [...CAPS_FAL_FP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_FAL_FP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_FAL_FP_METADATA.documentId,
    CAPS_FAL_FP_METADATA.documentVersion,
  ),
};

const lifeSkillsR3: CapsSourceInfo = {
  documentId: CAPS_LIFE_SKILLS_R3_METADATA.documentId,
  documentVersion: CAPS_LIFE_SKILLS_R3_METADATA.documentVersion,
  title: CAPS_LIFE_SKILLS_R3_METADATA.title,
  subject: CAPS_LIFE_SKILLS_R3_METADATA.subjectName,
  phase: mapPhase(CAPS_LIFE_SKILLS_R3_METADATA.phase),
  grades: [...CAPS_LIFE_SKILLS_R3_METADATA.grades],
  contentAreas: CAPS_LIFE_SKILLS_R3_STUDY_AREAS.map((s) => s.name),
  weightings: [],
  topicCount: CAPS_LIFE_SKILLS_R3_STUDY_AREAS.length,
  source: sourceRef(
    CAPS_LIFE_SKILLS_R3_METADATA.documentId,
    CAPS_LIFE_SKILLS_R3_METADATA.documentVersion,
  ),
};

const isiZuluFalFp: CapsSourceInfo = {
  documentId: CAPS_ISIZULU_FAL_GR13_METADATA.documentId,
  documentVersion: CAPS_ISIZULU_FAL_GR13_METADATA.documentVersion,
  title: CAPS_ISIZULU_FAL_GR13_METADATA.title,
  subject: CAPS_ISIZULU_FAL_GR13_METADATA.subjectName,
  phase: mapPhase(CAPS_ISIZULU_FAL_GR13_METADATA.phase),
  grades: [...CAPS_ISIZULU_FAL_GR13_METADATA.grades],
  contentAreas: CAPS_ISIZULU_FAL_GR13_SKILLS.map((s) => s.name),
  weightings: [],
  topicCount: CAPS_ISIZULU_FAL_GR13_SKILLS.length,
  source: sourceRef(
    CAPS_ISIZULU_FAL_GR13_METADATA.documentId,
    CAPS_ISIZULU_FAL_GR13_METADATA.documentVersion,
  ),
};

const codingRoboticsR3: CapsSourceInfo = {
  documentId: CAPS_CODING_ROBOTICS_R3_DOC_ID,
  documentVersion: CAPS_CODING_ROBOTICS_R3_VERSION,
  title: CAPS_CR_R3_METADATA.title,
  subject: CAPS_CR_R3_METADATA.subjectName,
  phase: mapPhase(CAPS_CR_R3_METADATA.phase),
  grades: [...CAPS_CR_R3_METADATA.grades],
  contentAreas: CAPS_CR_R3_STRANDS.map((s) => s.name),
  weightings: [],
  topicCount: CAPS_CR_R3_STRANDS.length,
  source: sourceRef(CAPS_CODING_ROBOTICS_R3_DOC_ID, CAPS_CODING_ROBOTICS_R3_VERSION),
};

// ---------------------------------------------------------------------------
// Intermediate Phase
// ---------------------------------------------------------------------------

const mathsIp: CapsSourceInfo = {
  documentId: CAPS_MATHS_IP_METADATA.documentId,
  documentVersion: CAPS_MATHS_IP_METADATA.documentVersion,
  title: CAPS_MATHS_IP_METADATA.title,
  subject: 'Mathematics',
  phase: 'INTERMEDIATE',
  grades: PHASE_GRADES['INTERMEDIATE'],
  contentAreas: [...CAPS_MATHS_IP_CONTENT_AREAS],
  weightings: CAPS_MATHS_IP_WEIGHTINGS.map((w): CapsWeightingEntry => ({
    contentArea: w.contentArea,
    grade: w.grade,
    weightingPercent: w.weightingPercent,
    clause: w.basis.clause,
  })),
  topicCount: CAPS_MATHS_IP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_MATHS_IP_METADATA.documentId,
    CAPS_MATHS_IP_METADATA.documentVersion,
  ),
};

const engHlIp: CapsSourceInfo = {
  documentId: CAPS_ENG_HL_IP_METADATA.documentId,
  documentVersion: CAPS_ENG_HL_IP_METADATA.documentVersion,
  title: CAPS_ENG_HL_IP_METADATA.title,
  subject: 'English Home Language',
  phase: 'INTERMEDIATE',
  grades: PHASE_GRADES['INTERMEDIATE'],
  contentAreas: [...CAPS_ENG_HL_IP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_ENG_HL_IP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_ENG_HL_IP_METADATA.documentId,
    CAPS_ENG_HL_IP_METADATA.documentVersion,
  ),
};

const engFalIp: CapsSourceInfo = {
  documentId: CAPS_ENG_FAL_IP_METADATA.documentId,
  documentVersion: CAPS_ENG_FAL_IP_METADATA.documentVersion,
  title: CAPS_ENG_FAL_IP_METADATA.title,
  subject: 'English First Additional Language',
  phase: 'INTERMEDIATE',
  grades: PHASE_GRADES['INTERMEDIATE'],
  contentAreas: [...CAPS_ENG_FAL_IP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_ENG_FAL_IP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_ENG_FAL_IP_METADATA.documentId,
    CAPS_ENG_FAL_IP_METADATA.documentVersion,
  ),
};

const nstIp: CapsSourceInfo = {
  documentId: CAPS_NST_IP_METADATA.documentId,
  documentVersion: CAPS_NST_IP_METADATA.documentVersion,
  title: CAPS_NST_IP_METADATA.title,
  subject: 'Natural Sciences and Technology',
  phase: 'INTERMEDIATE',
  grades: PHASE_GRADES['INTERMEDIATE'],
  contentAreas: [...CAPS_NST_IP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_NST_IP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_NST_IP_METADATA.documentId,
    CAPS_NST_IP_METADATA.documentVersion,
  ),
};

const socialSciencesIp: CapsSourceInfo = {
  documentId: CAPS_SS_IP_METADATA.documentId,
  documentVersion: CAPS_SS_IP_METADATA.documentVersion,
  title: CAPS_SS_IP_METADATA.title,
  subject: 'Social Sciences',
  phase: 'INTERMEDIATE',
  grades: PHASE_GRADES['INTERMEDIATE'],
  contentAreas: [...CAPS_SS_IP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_SS_IP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(CAPS_SS_IP_METADATA.documentId, CAPS_SS_IP_METADATA.documentVersion),
};

const lifeSkillsIp: CapsSourceInfo = {
  documentId: CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentId,
  documentVersion: CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentVersion,
  title: CAPS_IP_LIFE_SKILLS_GR46_METADATA.title,
  subject: CAPS_IP_LIFE_SKILLS_GR46_METADATA.subjectName,
  phase: mapPhase(CAPS_IP_LIFE_SKILLS_GR46_METADATA.phase),
  grades: [...CAPS_IP_LIFE_SKILLS_GR46_METADATA.grades],
  contentAreas: CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS.map((s) => s.name),
  weightings: [],
  topicCount: CAPS_IP_LIFE_SKILLS_GR46_STUDY_AREAS.length,
  source: sourceRef(
    CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentId,
    CAPS_IP_LIFE_SKILLS_GR46_METADATA.documentVersion,
  ),
};

// ---------------------------------------------------------------------------
// Senior Phase
// ---------------------------------------------------------------------------

const mathsSp: CapsSourceInfo = {
  documentId: CAPS_MATHS_SP_METADATA.documentId,
  documentVersion: CAPS_MATHS_SP_METADATA.documentVersion,
  title: CAPS_MATHS_SP_METADATA.title,
  subject: 'Mathematics',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_MATHS_SP_CONTENT_AREAS],
  weightings: CAPS_MATHS_SP_WEIGHTINGS.map((w): CapsWeightingEntry => ({
    contentArea: w.contentArea,
    grade: w.grade,
    weightingPercent: w.weightingPercent,
    clause: w.basis.clause,
  })),
  topicCount: CAPS_MATHS_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_MATHS_SP_METADATA.documentId,
    CAPS_MATHS_SP_METADATA.documentVersion,
  ),
};

const emsSp: CapsSourceInfo = {
  documentId: CAPS_EMS_SP_METADATA.documentId,
  documentVersion: CAPS_EMS_SP_METADATA.documentVersion,
  title: CAPS_EMS_SP_METADATA.title,
  subject: 'Economic and Management Sciences',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_EMS_SP_CONTENT_AREAS],
  weightings: CAPS_EMS_SP_WEIGHTINGS.map((w): CapsWeightingEntry => ({
    contentArea: w.contentArea,
    grade: w.grade,
    weightingPercent: w.weightingPercent,
    clause: w.basis.clause,
  })),
  topicCount: CAPS_EMS_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_EMS_SP_METADATA.documentId,
    CAPS_EMS_SP_METADATA.documentVersion,
  ),
};

const creativeArtsSp: CapsSourceInfo = {
  documentId: CAPS_CA_SP_METADATA.documentId,
  documentVersion: CAPS_CA_SP_METADATA.documentVersion,
  title: CAPS_CA_SP_METADATA.title,
  subject: 'Creative Arts',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_CA_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_CA_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(CAPS_CA_SP_METADATA.documentId, CAPS_CA_SP_METADATA.documentVersion),
};

const falSp: CapsSourceInfo = {
  documentId: CAPS_FAL_SP_METADATA.documentId,
  documentVersion: CAPS_FAL_SP_METADATA.documentVersion,
  title: CAPS_FAL_SP_METADATA.title,
  subject: 'First Additional Language',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_FAL_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_FAL_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_FAL_SP_METADATA.documentId,
    CAPS_FAL_SP_METADATA.documentVersion,
  ),
};

const hlSp: CapsSourceInfo = {
  documentId: CAPS_HL_SP_METADATA.documentId,
  documentVersion: CAPS_HL_SP_METADATA.documentVersion,
  title: CAPS_HL_SP_METADATA.title,
  subject: 'Home Language',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_HL_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_HL_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(CAPS_HL_SP_METADATA.documentId, CAPS_HL_SP_METADATA.documentVersion),
};

const naturalSciencesSp: CapsSourceInfo = {
  documentId: CAPS_NS_SP_METADATA.documentId,
  documentVersion: CAPS_NS_SP_METADATA.documentVersion,
  title: CAPS_NS_SP_METADATA.title,
  subject: 'Natural Sciences',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_NS_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_NS_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(CAPS_NS_SP_METADATA.documentId, CAPS_NS_SP_METADATA.documentVersion),
};

const socialSciencesSp: CapsSourceInfo = {
  documentId: CAPS_SS_SP_METADATA.documentId,
  documentVersion: CAPS_SS_SP_METADATA.documentVersion,
  title: CAPS_SS_SP_METADATA.title,
  subject: 'Social Sciences',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_SS_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_SS_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(CAPS_SS_SP_METADATA.documentId, CAPS_SS_SP_METADATA.documentVersion),
};

const technologySp: CapsSourceInfo = {
  documentId: CAPS_TECH_SP_METADATA.documentId,
  documentVersion: CAPS_TECH_SP_METADATA.documentVersion,
  title: CAPS_TECH_SP_METADATA.title,
  subject: 'Technology',
  phase: 'SENIOR',
  grades: PHASE_GRADES['SENIOR'],
  contentAreas: [...CAPS_TECH_SP_CONTENT_AREAS],
  weightings: [],
  topicCount: CAPS_TECH_SP_TOPIC_PROGRESSIONS.length,
  source: sourceRef(
    CAPS_TECH_SP_METADATA.documentId,
    CAPS_TECH_SP_METADATA.documentVersion,
  ),
};

const lifeOrientationSp: CapsSourceInfo = {
  documentId: CAPS_LO_SP_GR79_METADATA.documentId,
  documentVersion: CAPS_LO_SP_GR79_METADATA.documentVersion,
  title: CAPS_LO_SP_GR79_METADATA.title,
  subject: CAPS_LO_SP_GR79_METADATA.subjectName,
  phase: mapPhase(CAPS_LO_SP_GR79_METADATA.phase),
  grades: [...CAPS_LO_SP_GR79_METADATA.grades],
  contentAreas: CAPS_LO_SP_GR79_TOPICS.map((t) => t.name),
  weightings: [],
  topicCount: CAPS_LO_SP_GR79_TOPICS.length,
  source: sourceRef(
    CAPS_LO_SP_GR79_METADATA.documentId,
    CAPS_LO_SP_GR79_METADATA.documentVersion,
  ),
};

// ---------------------------------------------------------------------------
// Full collection — 21 CAPS source documents
// ---------------------------------------------------------------------------

export const ALL_CAPS_SOURCES: readonly CapsSourceInfo[] = [
  // Foundation Phase (6)
  mathsFp,
  engHlFp,
  falFp,
  lifeSkillsR3,
  isiZuluFalFp,
  codingRoboticsR3,
  // Intermediate Phase (6)
  mathsIp,
  engHlIp,
  engFalIp,
  nstIp,
  socialSciencesIp,
  lifeSkillsIp,
  // Senior Phase (9)
  mathsSp,
  emsSp,
  creativeArtsSp,
  falSp,
  hlSp,
  naturalSciencesSp,
  socialSciencesSp,
  technologySp,
  lifeOrientationSp,
];
