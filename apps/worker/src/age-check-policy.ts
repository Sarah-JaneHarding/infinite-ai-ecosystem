// Which pipelines must never run without an age-appropriateness checker (audit R05 / T09).
//
// Before this, a MOD-01 or MOD-04 job that arrived without `gradePhase` simply ran with no
// checker at all: `checkAgeAppropriateness(output, undefined)` passes everything. Missing
// context quietly turned the guardrail off. For these pipelines it now refuses the job
// before any database or model call, because their output is educator- and learner-facing
// content and the phase is what grounds the check.
//
// Deliberately a closed list of pipeline ids, not "every pipeline with a phase": a new
// content-generating pipeline has to be added here on purpose, in a reviewed change.

import {
  MOD01_CURRICULUM_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
} from '@infinite-ai/orchestrator';

export const AGE_CHECKED_PIPELINE_IDS: ReadonlySet<string> = new Set([
  MOD01_CURRICULUM_PIPELINE.id,
  MOD04_TOOLBOX_PIPELINE.id,
]);

/** Thrown before any tenant transaction or model call when an age-checked pipeline has no
 * checker it can use. The job fails; nothing is generated. */
export class AgeCheckUnavailableError extends Error {
  constructor(
    readonly pipelineId: string,
    readonly reason: 'missing_grade_phase' | 'no_checker_configured',
  ) {
    super(
      reason === 'missing_grade_phase'
        ? `Pipeline "${pipelineId}" requires gradePhase on the job so its output can be age-checked; refusing to run without it.`
        : `Pipeline "${pipelineId}" requires an age-appropriateness checker, but this worker has none configured; refusing to run.`,
    );
    this.name = 'AgeCheckUnavailableError';
  }
}
