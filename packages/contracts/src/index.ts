// @infinite-ai/contracts — Zod schemas shared by the API, agents and UI.

export {
  AssessmentWeighting,
  CurriculumFramework,
  FrameworkNeedsInput,
  FrameworkResult,
  GradeFramework,
  GradeLabel,
  Phase,
  SourceRef,
  Sourced,
  SubjectFramework,
  TimeAllocation,
} from './curriculum/framework.js';

export const PACKAGE_NAME = '@infinite-ai/contracts' as const;
