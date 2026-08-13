// Pre-built workflow templates — Stage 19 (Visual Agent Builder).
//
// Six education-domain templates that provide a starting point for common
// workflow patterns. Each template is a WorkflowGraph with pre-wired nodes
// and edges. Callers should clone (via importWorkflow(exportWorkflow(t))) and
// assign their own unique ids before editing.

import { type WorkflowGraph } from './workflow.js';

// ─── Template: Lesson Plan Generation ────────────────────────────────────────

const lessonPlanTemplate: WorkflowGraph = {
  id: 'tpl-lesson-plan',
  name: 'Lesson Plan Generation',
  description:
    'Generates a CAPS-aligned lesson plan from a curriculum objective, passes it through a human review gate, and emits a final approved document.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'lp-input',
      type: 'Input.objective',
      category: 'Input',
      label: 'Curriculum Objective',
      position: { x: 80, y: 200 },
      config: {},
    },
    {
      id: 'lp-ce03',
      type: 'CE-03',
      category: 'CE',
      label: 'Lesson Plan Agent',
      position: { x: 320, y: 200 },
      config: {},
    },
    {
      id: 'lp-gate',
      type: 'Gate.approval',
      category: 'Gate',
      label: 'Educator Approval',
      position: { x: 560, y: 200 },
      config: { timeoutHours: 48 },
    },
    {
      id: 'lp-output',
      type: 'Output.document',
      category: 'Output',
      label: 'Approved Lesson Plan',
      position: { x: 800, y: 200 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'lp-e1',
      sourceNodeId: 'lp-input',
      sourcePortName: 'objective',
      targetNodeId: 'lp-ce03',
      targetPortName: 'objective',
    },
    {
      id: 'lp-e2',
      sourceNodeId: 'lp-ce03',
      sourcePortName: 'lesson_plan',
      targetNodeId: 'lp-gate',
      targetPortName: 'artefact',
    },
    {
      id: 'lp-e3',
      sourceNodeId: 'lp-gate',
      sourcePortName: 'approved_artefact',
      targetNodeId: 'lp-output',
      targetPortName: 'document',
    },
  ],
};

// ─── Template: Assessment Creation ───────────────────────────────────────────

const assessmentTemplate: WorkflowGraph = {
  id: 'tpl-assessment',
  name: 'Assessment Creation',
  description:
    'Produces a CAPS-aligned assessment from a lesson plan or topic, reviews it against the rubric agent, then routes to an educator gate before publication.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'as-input',
      type: 'Input.document',
      category: 'Input',
      label: 'Lesson Plan',
      position: { x: 80, y: 200 },
      config: {},
    },
    {
      id: 'as-ce04',
      type: 'CE-04',
      category: 'CE',
      label: 'Assessment Agent',
      position: { x: 320, y: 200 },
      config: {},
    },
    {
      id: 'as-ce05',
      type: 'CE-05',
      category: 'CE',
      label: 'Rubric Reviewer',
      position: { x: 560, y: 200 },
      config: {},
    },
    {
      id: 'as-gate',
      type: 'Gate.approval',
      category: 'Gate',
      label: 'Educator Sign-off',
      position: { x: 800, y: 200 },
      config: { timeoutHours: 72 },
    },
    {
      id: 'as-output',
      type: 'Output.document',
      category: 'Output',
      label: 'Published Assessment',
      position: { x: 1040, y: 200 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'as-e1',
      sourceNodeId: 'as-input',
      sourcePortName: 'document',
      targetNodeId: 'as-ce04',
      targetPortName: 'lesson_plan',
    },
    {
      id: 'as-e2',
      sourceNodeId: 'as-ce04',
      sourcePortName: 'assessment',
      targetNodeId: 'as-ce05',
      targetPortName: 'assessment',
    },
    {
      id: 'as-e3',
      sourceNodeId: 'as-ce05',
      sourcePortName: 'reviewed_assessment',
      targetNodeId: 'as-gate',
      targetPortName: 'artefact',
    },
    {
      id: 'as-e4',
      sourceNodeId: 'as-gate',
      sourcePortName: 'approved_artefact',
      targetNodeId: 'as-output',
      targetPortName: 'document',
    },
  ],
};

// ─── Template: SIAS Report ────────────────────────────────────────────────────

const siasReportTemplate: WorkflowGraph = {
  id: 'tpl-sias-report',
  name: 'SIAS Report',
  description:
    'Collects learner support data, runs the SIAS intake screener, branches on severity level, and routes serious cases to a human gate before generating the formal SIAS report.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'si-input',
      type: 'Input.structured',
      category: 'Input',
      label: 'Learner Support Data',
      position: { x: 80, y: 240 },
      config: {},
    },
    {
      id: 'si-ac01',
      type: 'AC-01',
      category: 'AC',
      label: 'SIAS Screener',
      position: { x: 320, y: 240 },
      config: {},
    },
    {
      id: 'si-branch',
      type: 'Branch.severity',
      category: 'Branch',
      label: 'Severity Branch',
      position: { x: 560, y: 240 },
      config: { threshold: 'moderate' },
    },
    {
      id: 'si-gate',
      type: 'Gate.approval',
      category: 'Gate',
      label: 'SBST Approval',
      position: { x: 800, y: 140 },
      config: { timeoutHours: 96 },
    },
    {
      id: 'si-ac02',
      type: 'AC-02',
      category: 'AC',
      label: 'SIAS Report Generator',
      position: { x: 1040, y: 240 },
      config: {},
    },
    {
      id: 'si-output',
      type: 'Output.document',
      category: 'Output',
      label: 'SIAS Report',
      position: { x: 1280, y: 240 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'si-e1',
      sourceNodeId: 'si-input',
      sourcePortName: 'structured',
      targetNodeId: 'si-ac01',
      targetPortName: 'learner_data',
    },
    {
      id: 'si-e2',
      sourceNodeId: 'si-ac01',
      sourcePortName: 'screening_result',
      targetNodeId: 'si-branch',
      targetPortName: 'structured',
    },
    {
      id: 'si-e3',
      sourceNodeId: 'si-branch',
      sourcePortName: 'high_branch',
      targetNodeId: 'si-gate',
      targetPortName: 'artefact',
    },
    {
      id: 'si-e4',
      sourceNodeId: 'si-gate',
      sourcePortName: 'approved_artefact',
      targetNodeId: 'si-ac02',
      targetPortName: 'screening_result',
    },
    {
      id: 'si-e5',
      sourceNodeId: 'si-branch',
      sourcePortName: 'low_branch',
      targetNodeId: 'si-ac02',
      targetPortName: 'screening_result',
    },
    {
      id: 'si-e6',
      sourceNodeId: 'si-ac02',
      sourcePortName: 'sias_report',
      targetNodeId: 'si-output',
      targetPortName: 'document',
    },
  ],
};

// ─── Template: Learning Engine Cycle ─────────────────────────────────────────

const learningEngineCycleTemplate: WorkflowGraph = {
  id: 'tpl-learning-engine-cycle',
  name: 'Learning Engine Cycle',
  description:
    'Runs a full personalised learning cycle: diagnoses a learner, selects a learning path, delivers content, checks understanding, and adapts based on the outcome.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'le-input',
      type: 'Input.structured',
      category: 'Input',
      label: 'Learner Profile',
      position: { x: 80, y: 240 },
      config: {},
    },
    {
      id: 'le-diag',
      type: 'LE-01',
      category: 'LE',
      label: 'Diagnostic Agent',
      position: { x: 320, y: 240 },
      config: {},
    },
    {
      id: 'le-path',
      type: 'LE-02',
      category: 'LE',
      label: 'Learning Path Selector',
      position: { x: 560, y: 240 },
      config: {},
    },
    {
      id: 'le-content',
      type: 'LE-03',
      category: 'LE',
      label: 'Content Delivery',
      position: { x: 800, y: 240 },
      config: {},
    },
    {
      id: 'le-check',
      type: 'LE-04',
      category: 'LE',
      label: 'Comprehension Check',
      position: { x: 1040, y: 240 },
      config: {},
    },
    {
      id: 'le-branch',
      type: 'Branch.outcome',
      category: 'Branch',
      label: 'Outcome Branch',
      position: { x: 1280, y: 240 },
      config: {},
    },
    {
      id: 'le-output',
      type: 'Output.structured',
      category: 'Output',
      label: 'Learning Record',
      position: { x: 1520, y: 140 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'le-e1',
      sourceNodeId: 'le-input',
      sourcePortName: 'structured',
      targetNodeId: 'le-diag',
      targetPortName: 'learner_profile',
    },
    {
      id: 'le-e2',
      sourceNodeId: 'le-diag',
      sourcePortName: 'diagnosis',
      targetNodeId: 'le-path',
      targetPortName: 'diagnosis',
    },
    {
      id: 'le-e3',
      sourceNodeId: 'le-path',
      sourcePortName: 'learning_path',
      targetNodeId: 'le-content',
      targetPortName: 'learning_path',
    },
    {
      id: 'le-e4',
      sourceNodeId: 'le-content',
      sourcePortName: 'content',
      targetNodeId: 'le-check',
      targetPortName: 'content',
    },
    {
      id: 'le-e5',
      sourceNodeId: 'le-check',
      sourcePortName: 'check_result',
      targetNodeId: 'le-branch',
      targetPortName: 'structured',
    },
    {
      id: 'le-e6',
      sourceNodeId: 'le-branch',
      sourcePortName: 'pass_branch',
      targetNodeId: 'le-output',
      targetPortName: 'structured',
    },
  ],
};

// ─── Template: Support Tier Routing ──────────────────────────────────────────

const supportTierRoutingTemplate: WorkflowGraph = {
  id: 'tpl-support-tier-routing',
  name: 'Support Tier Routing',
  description:
    'Analyses a learner support request, classifies it by tier (classroom/school/district), routes Tier 2+ cases to an SBST gate, and dispatches the appropriate intervention plan.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'st-input',
      type: 'Input.structured',
      category: 'Input',
      label: 'Support Request',
      position: { x: 80, y: 240 },
      config: {},
    },
    {
      id: 'st-ac03',
      type: 'AC-03',
      category: 'AC',
      label: 'Tier Classifier',
      position: { x: 320, y: 240 },
      config: {},
    },
    {
      id: 'st-branch',
      type: 'Branch.tier',
      category: 'Branch',
      label: 'Tier Branch',
      position: { x: 560, y: 240 },
      config: {},
    },
    {
      id: 'st-gate',
      type: 'Gate.approval',
      category: 'Gate',
      label: 'SBST Gate',
      position: { x: 800, y: 140 },
      config: { timeoutHours: 48 },
    },
    {
      id: 'st-ac04',
      type: 'AC-04',
      category: 'AC',
      label: 'Intervention Planner',
      position: { x: 1040, y: 240 },
      config: {},
    },
    {
      id: 'st-output',
      type: 'Output.document',
      category: 'Output',
      label: 'Intervention Plan',
      position: { x: 1280, y: 240 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'st-e1',
      sourceNodeId: 'st-input',
      sourcePortName: 'structured',
      targetNodeId: 'st-ac03',
      targetPortName: 'support_request',
    },
    {
      id: 'st-e2',
      sourceNodeId: 'st-ac03',
      sourcePortName: 'tier_classification',
      targetNodeId: 'st-branch',
      targetPortName: 'structured',
    },
    {
      id: 'st-e3',
      sourceNodeId: 'st-branch',
      sourcePortName: 'high_branch',
      targetNodeId: 'st-gate',
      targetPortName: 'artefact',
    },
    {
      id: 'st-e4',
      sourceNodeId: 'st-gate',
      sourcePortName: 'approved_artefact',
      targetNodeId: 'st-ac04',
      targetPortName: 'tier_classification',
    },
    {
      id: 'st-e5',
      sourceNodeId: 'st-branch',
      sourcePortName: 'low_branch',
      targetNodeId: 'st-ac04',
      targetPortName: 'tier_classification',
    },
    {
      id: 'st-e6',
      sourceNodeId: 'st-ac04',
      sourcePortName: 'intervention_plan',
      targetNodeId: 'st-output',
      targetPortName: 'document',
    },
  ],
};

// ─── Template: Weekly PD Brief ────────────────────────────────────────────────

const weeklyPdBriefTemplate: WorkflowGraph = {
  id: 'tpl-weekly-pd-brief',
  name: 'Weekly PD Brief',
  description:
    'Aggregates classroom observation data and learner analytics, synthesises a personalised professional-development brief for the educator, and routes it through a PD coordinator gate.',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  nodes: [
    {
      id: 'pd-obs-input',
      type: 'Input.structured',
      category: 'Input',
      label: 'Observation Data',
      position: { x: 80, y: 160 },
      config: {},
    },
    {
      id: 'pd-analytics-input',
      type: 'Input.structured',
      category: 'Input',
      label: 'Learner Analytics',
      position: { x: 80, y: 320 },
      config: {},
    },
    {
      id: 'pd-pd01',
      type: 'PD-01',
      category: 'PD',
      label: 'PD Needs Analyser',
      position: { x: 320, y: 240 },
      config: {},
    },
    {
      id: 'pd-pd02',
      type: 'PD-02',
      category: 'PD',
      label: 'PD Brief Writer',
      position: { x: 560, y: 240 },
      config: {},
    },
    {
      id: 'pd-gate',
      type: 'Gate.approval',
      category: 'Gate',
      label: 'PD Coordinator Review',
      position: { x: 800, y: 240 },
      config: { timeoutHours: 24 },
    },
    {
      id: 'pd-output',
      type: 'Output.document',
      category: 'Output',
      label: 'PD Brief',
      position: { x: 1040, y: 240 },
      config: {},
    },
  ],
  edges: [
    {
      id: 'pd-e1',
      sourceNodeId: 'pd-obs-input',
      sourcePortName: 'structured',
      targetNodeId: 'pd-pd01',
      targetPortName: 'observation_data',
    },
    {
      id: 'pd-e2',
      sourceNodeId: 'pd-analytics-input',
      sourcePortName: 'structured',
      targetNodeId: 'pd-pd01',
      targetPortName: 'analytics_data',
    },
    {
      id: 'pd-e3',
      sourceNodeId: 'pd-pd01',
      sourcePortName: 'pd_needs',
      targetNodeId: 'pd-pd02',
      targetPortName: 'pd_needs',
    },
    {
      id: 'pd-e4',
      sourceNodeId: 'pd-pd02',
      sourcePortName: 'pd_brief',
      targetNodeId: 'pd-gate',
      targetPortName: 'artefact',
    },
    {
      id: 'pd-e5',
      sourceNodeId: 'pd-gate',
      sourcePortName: 'approved_artefact',
      targetNodeId: 'pd-output',
      targetPortName: 'document',
    },
  ],
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: ReadonlyMap<string, WorkflowGraph> = new Map([
  ['lesson-plan', lessonPlanTemplate],
  ['assessment', assessmentTemplate],
  ['sias-report', siasReportTemplate],
  ['learning-engine-cycle', learningEngineCycleTemplate],
  ['support-tier-routing', supportTierRoutingTemplate],
  ['weekly-pd-brief', weeklyPdBriefTemplate],
]);

export type TemplateKey = keyof typeof _TEMPLATE_KEYS;
const _TEMPLATE_KEYS = {
  'lesson-plan': true,
  assessment: true,
  'sias-report': true,
  'learning-engine-cycle': true,
  'support-tier-routing': true,
  'weekly-pd-brief': true,
} as const;

/** Returns the template with the given key, or undefined if unknown. */
export function getTemplate(key: string): WorkflowGraph | undefined {
  return WORKFLOW_TEMPLATES.get(key);
}

/** Returns all template keys. */
export function listTemplates(): string[] {
  return Array.from(WORKFLOW_TEMPLATES.keys());
}
