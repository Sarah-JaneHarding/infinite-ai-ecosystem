// The POPIA vocabularies, the curriculum framework and the gateway's wire contract are
// re-exported from one place so the packages on both sides of each boundary agree with
// this package rather than with each other. This asserts the barrel stays complete.

import { describe, expect, it } from 'vitest';

import * as contracts from '../src/index.js';

describe('package export surface', () => {
  it('exports the POPIA vocabularies, the curriculum framework and the gateway contract', () => {
    // Widened deliberately each time a new family merged. The list is spelled out rather
    // than counted, so a stray export has to be added here by someone who looked at it —
    // which is the only reason a test like this earns its keep.
    expect(Object.keys(contracts).sort()).toEqual([
      'ATPNeedsInput',
      'ATPResult',
      'ATPSchedule',
      'ATPTopicEntry',
      'ATPWeek',
      'ActivityKind',
      'ArtefactType',
      'AssessmentDesignNeedsInput',
      'AssessmentQuestion',
      'AssessmentSection',
      'AssessmentTaskDesign',
      'AssessmentTaskDesignResult',
      'AssessmentTaskKind',
      'AssessmentWeighting',
      'CE01Input',
      'CE02Input',
      'CE03Input',
      'CE04Input',
      'CE05Input',
      'CE06Input',
      'CE07Input',
      'CE08Input',
      'CE09Input',
      'ChatCompletionRequest',
      'ChatCompletionResponse',
      'ChatCompletionStreamEvent',
      'ChatCompletionUsage',
      'ChatMessage',
      'ChatRole',
      'CognitiveLevel',
      'CognitiveLevelSpread',
      'ConsentDecision',
      'ConsentEntry',
      'ConsentEntryDraft',
      'ConsentSource',
      'CoverageAudit',
      'CoverageAuditNeedsInput',
      'CoverageAuditResult',
      'CurriculumFramework',
      'DataCategory',
      'DeidentificationProvenance',
      'DifferentiatedSet',
      'DifferentiatedTier',
      'DifferentiationNeedsInput',
      'DifferentiationResult',
      'DifferentiationTierName',
      'DriftItem',
      'DriftKind',
      'EmbeddingsRequest',
      'EmbeddingsResponse',
      'EvidenceItem',
      'FrameworkNeedsInput',
      'FrameworkResult',
      'GatewayErrorBody',
      'GatewayErrorCode',
      'GradeFramework',
      'GradeLabel',
      'LawfulBasis',
      'Lesson',
      'LessonActivity',
      'LessonPlan',
      'LessonPlanNeedsInput',
      'LessonPlanResult',
      'LogicalModel',
      'PACKAGE_NAME',
      'PURPOSES',
      'Phase',
      'Purpose',
      'RetentionAnchor',
      'RetentionRule',
      'RetentionSchedule',
      'Rubric',
      'RubricCriterion',
      'RubricDescriptors',
      'RubricNeedsInput',
      'RubricResult',
      'SchoolCalendarBlock',
      'SourceRef',
      'Sourced',
      'SubjectFramework',
      'SuccessCriterion',
      'TemplateDefinition',
      'TemplateField',
      'TemplateSection',
      'TermAssessmentTask',
      'TermPlan',
      'TermPlanNeedsInput',
      'TermPlanResult',
      'TermPlanSubject',
      'TermPlanWeekEntry',
      'TimeAllocation',
      'ToolCall',
      'ToolDefinition',
      'UnitBlueprint',
      'UnitBlueprintResult',
      'UnitNeedsInput',
      'WITHDRAWABLE_BASES',
      'WeekKind',
      'addMonths',
      'checkArtefactStructure',
      'definitionOf',
      'evaluateRetention',
      'isWithdrawable',
      'permits',
      'projectCategories',
      'reviewSchedule',
      'ruleFor',
      'unscheduledCategories',
    ]);
  });

  it('ships no retention schedule, default or example', () => {
    // The periods are each school's legal determination, ratified in its L0 constitution.
    // An exported default here would be adopted by every tenant that never got round to
    // ratifying one, which is the opposite of what ratification is for. See OQ-007.
    for (const [name, value] of Object.entries(contracts)) {
      if (!Array.isArray(value)) continue;
      expect(
        value.some(
          (entry) =>
            typeof entry === 'object' && entry !== null && 'retainMonths' in entry,
        ),
        `${name} contains a retention period`,
      ).toBe(false);
    }
  });
});
