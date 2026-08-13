import type { SourceRef } from '../../curriculum/framework.js';
import type { PolicyDocMetadata } from '../types.js';

export const DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID =
  'dbe-learner-diversity-caps-2011' as const;
export const DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION = '2011' as const;

function ref(clause: string, page?: number): SourceRef {
  return {
    documentId: DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
    documentVersion: DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
    clause,
    page,
    ratifiedBy: null,
  };
}

export const DBE_LEARNER_DIVERSITY_CAPS_2011_SECTIONS = {
  /** Principles of curriculum differentiation for diverse learners. */
  differentiationPrinciples: ref('Section 2: Curriculum Differentiation Principles', 6),
  /** Differentiation through content and learning outcomes. */
  contentDifferentiation: ref('Section 2.1: Differentiation through Content', 8),
  /** Adapting the learning environment for diverse needs. */
  learningEnvironment: ref(
    'Section 2.2: Differentiation through Learning Environment',
    10,
  ),
  /** Differentiating teaching methods and strategies. */
  teachingMethods: ref('Section 2.3: Differentiation through Teaching Methods', 12),
  /** Assessment adaptations for learners with barriers to learning. */
  assessmentDifferentiation: ref(
    'Section 2.4: Differentiation through Assessment and Accommodations',
    15,
  ),
  /** Recording and reporting for learners with additional support needs. */
  recordingAndReporting: ref('Section 3: Recording and Reporting', 25),
  /** Accessing support — school-level, district-level and specialist services. */
  accessingSupport: ref('Section 4: Accessing Support', 30),
} as const;

export const DBE_LEARNER_DIVERSITY_CAPS_2011_METADATA: PolicyDocMetadata = {
  documentId: DBE_LEARNER_DIVERSITY_CAPS_2011_DOC_ID,
  documentVersion: DBE_LEARNER_DIVERSITY_CAPS_2011_VERSION,
  title:
    'Guidelines for Responding to Learner Diversity in the Classroom Through Curriculum and Assessment Policy Statements',
  publisher: 'Department of Basic Education, Directorate Inclusive Education',
  kind: 'GUIDELINE',
  ratifiedBy: null,
  pageCount: 39,
};
