export {
  DbePhaseSchema,
  DbeSubjectCategorySchema,
  DBE_ALLOCATIONS,
  getDbeAllocation,
  getDbeAllocationsByPhase,
  assertRegistryIntegrity,
} from './dbe-allocations.js';
export type {
  DbePhase,
  DbeSubjectCategory,
  DbeTimeAllocation,
  DbeAssessmentWeighting,
  DbeGradeAllocation,
} from './dbe-allocations.js';
export { mapSubjectToCategory } from './subject-mapper.js';
