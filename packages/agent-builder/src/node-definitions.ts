// Node type catalogue — Stage 19 (Visual Agent Builder).
//
// Every node type a designer can place on the canvas is declared here. The
// definition gives the builder enough information to:
//   - Render the correct node card and port connectors in the UI.
//   - Validate edges (port name and type must match across a connection).
//   - Generate a human-readable label for a freshly placed node.
//
// 54+ types across 11 categories (CE, AC, DW, TB, PD, LE, Branch, Gate,
// Tool, Input, Output) as specified in Stage 19.

import { z } from 'zod';

import { type NodeCategory, type PortDefinition } from './workflow.js';

// ─── Node definition schema ───────────────────────────────────────────────────

export const NodeDefinition = z.object({
  type: z.string().min(1),
  category: z.enum([
    'CE',
    'AC',
    'DW',
    'TB',
    'PD',
    'LE',
    'Branch',
    'Gate',
    'Tool',
    'Input',
    'Output',
  ]),
  label: z.string().min(1),
  description: z.string(),
  inputs: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(['text', 'document', 'structured', 'signal', 'approval']),
      required: z.boolean(),
      description: z.string().optional(),
    }),
  ),
  outputs: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(['text', 'document', 'structured', 'signal', 'approval']),
      required: z.boolean(),
      description: z.string().optional(),
    }),
  ),
  configSchema: z.record(z.string()).optional(),
});
export type NodeDefinition = z.infer<typeof NodeDefinition>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inp(
  name: string,
  type: PortDefinition['type'],
  required = true,
  description?: string,
): PortDefinition {
  return { name, type, required, description };
}

function out(
  name: string,
  type: PortDefinition['type'],
  required = true,
  description?: string,
): PortDefinition {
  return { name, type, required, description };
}

// ─── Curriculum Engine (CE) ───────────────────────────────────────────────────

const CE_NODES: NodeDefinition[] = [
  {
    type: 'CE-01',
    category: 'CE',
    label: 'ATP Ingest',
    description: 'Ingests an Annual Teaching Plan document and updates the Brain.',
    inputs: [inp('atpDocument', 'document')],
    outputs: [out('curriculumMap', 'structured')],
  },
  {
    type: 'CE-02',
    category: 'CE',
    label: 'Curriculum Map Builder',
    description: 'Builds a term-level curriculum map from CAPS and ATP.',
    inputs: [inp('capsData', 'structured'), inp('atpData', 'structured')],
    outputs: [out('curriculumMap', 'document')],
  },
  {
    type: 'CE-03',
    category: 'CE',
    label: 'Lesson Plan Generator',
    description: 'Generates a 60-minute lesson plan for a given topic and grade.',
    inputs: [inp('topic', 'text'), inp('context', 'structured', false)],
    outputs: [out('lessonPlan', 'document')],
  },
  {
    type: 'CE-04',
    category: 'CE',
    label: 'Assessment Creator',
    description: 'Creates an assessment task with marking guide.',
    inputs: [inp('topic', 'text'), inp('questionCount', 'structured', false)],
    outputs: [out('assessment', 'document'), out('markingGuide', 'document')],
  },
  {
    type: 'CE-05',
    category: 'CE',
    label: 'Rubric Builder',
    description: 'Builds a detailed assessment rubric.',
    inputs: [inp('taskSpec', 'document')],
    outputs: [out('rubric', 'document')],
  },
  {
    type: 'CE-06',
    category: 'CE',
    label: 'Unit Blueprint',
    description: 'Creates a multi-week unit blueprint with scope and sequence.',
    inputs: [inp('topic', 'text'), inp('weeks', 'structured')],
    outputs: [out('unitBlueprint', 'document')],
  },
  {
    type: 'CE-07',
    category: 'CE',
    label: 'CAPS Sequencer',
    description: 'Orders CAPS topics into a pedagogically sound sequence.',
    inputs: [inp('capsTopics', 'structured')],
    outputs: [out('sequence', 'structured')],
  },
  {
    type: 'CE-08',
    category: 'CE',
    label: 'Pacing Adviser',
    description: 'Advises on curriculum pacing against the calendar.',
    inputs: [inp('curriculumMap', 'structured'), inp('calendarData', 'structured')],
    outputs: [out('pacingReport', 'document')],
  },
  {
    type: 'CE-09',
    category: 'CE',
    label: 'Differentiation Engine',
    description: 'Produces support, core and extension differentiation for a lesson.',
    inputs: [inp('lessonPlan', 'document')],
    outputs: [out('differentiatedMaterials', 'document')],
  },
  {
    type: 'CE-10',
    category: 'CE',
    label: 'Template Fidelity Checker',
    description: 'Validates an artefact against its structural template.',
    inputs: [inp('artefact', 'document'), inp('templateRef', 'text')],
    outputs: [out('fidelityReport', 'structured'), out('isValid', 'signal')],
  },
];

// ─── Support Analytics (AC) ───────────────────────────────────────────────────

const AC_NODES: NodeDefinition[] = [
  {
    type: 'AC-01',
    category: 'AC',
    label: 'Universal Screener',
    description: 'Runs EGRA / maths diagnostic screening on a learner cohort.',
    inputs: [inp('learnerCohort', 'structured')],
    outputs: [out('screeningResults', 'structured')],
  },
  {
    type: 'AC-02',
    category: 'AC',
    label: 'Core-Health Analyst',
    description: 'Analyses academic, behaviour, attendance and social-emotional signals.',
    inputs: [inp('learnerSignals', 'structured')],
    outputs: [out('healthProfile', 'structured')],
  },
  {
    type: 'AC-03',
    category: 'AC',
    label: 'Tier Recommender',
    description: 'Recommends an RTI support tier based on evidence.',
    inputs: [inp('healthProfile', 'structured')],
    outputs: [out('tierRecommendation', 'structured'), out('evidence', 'document')],
  },
  {
    type: 'AC-04',
    category: 'AC',
    label: 'Early Warning Agent',
    description: 'Raises alerts for academic, attendance or behaviour risks.',
    inputs: [inp('learnerSignals', 'structured')],
    outputs: [out('alerts', 'structured')],
  },
  {
    type: 'AC-05',
    category: 'AC',
    label: 'Intervention Planner',
    description: 'Creates a structured intervention plan for a learner.',
    inputs: [
      inp('tierRecommendation', 'structured'),
      inp('learnerProfile', 'structured'),
    ],
    outputs: [out('interventionPlan', 'document')],
  },
  {
    type: 'AC-06',
    category: 'AC',
    label: 'Progress Monitor',
    description: 'Tracks learner progress against an intervention plan.',
    inputs: [inp('interventionPlan', 'document'), inp('progressData', 'structured')],
    outputs: [out('progressReport', 'document')],
  },
  {
    type: 'AC-07',
    category: 'AC',
    label: 'Fidelity Checker',
    description: 'Monitors implementation fidelity of an intervention.',
    inputs: [inp('interventionPlan', 'document'), inp('observationData', 'structured')],
    outputs: [out('fidelityReport', 'structured')],
  },
  {
    type: 'AC-08',
    category: 'AC',
    label: 'SBST Meeting Scribe',
    description: 'Generates SBST meeting minutes and action items.',
    inputs: [inp('meetingNotes', 'text')],
    outputs: [out('minutes', 'document'), out('actionItems', 'structured')],
  },
  {
    type: 'AC-09',
    category: 'AC',
    label: 'SIAS Compiler',
    description: 'Compiles a comprehensive SIAS report for a learner.',
    inputs: [inp('learnerDossier', 'structured')],
    outputs: [out('siasReport', 'document')],
  },
  {
    type: 'AC-10',
    category: 'AC',
    label: 'Parent Report Writer',
    description: 'Writes a parent-friendly progress report.',
    inputs: [inp('progressReport', 'document'), inp('tone', 'text', false)],
    outputs: [out('parentReport', 'document')],
  },
];

// ─── Data Warehouse (DW) ──────────────────────────────────────────────────────

const DW_NODES: NodeDefinition[] = [
  {
    type: 'DW-01',
    category: 'DW',
    label: 'Data Ingestion Agent',
    description: 'Ingests and validates school data into the landing zone.',
    inputs: [inp('rawData', 'structured')],
    outputs: [out('landingRecord', 'structured'), out('validationReport', 'document')],
  },
  {
    type: 'DW-02',
    category: 'DW',
    label: 'Schema Mapper',
    description: 'Maps source fields to canonical data model.',
    inputs: [inp('landingRecord', 'structured'), inp('mappingConfig', 'structured')],
    outputs: [out('mappedRecord', 'structured')],
  },
  {
    type: 'DW-03',
    category: 'DW',
    label: 'De-identification Agent',
    description: 'Strips PII and applies k-anonymity to a dataset.',
    inputs: [inp('rawDataset', 'structured')],
    outputs: [out('deidentifiedDataset', 'structured')],
  },
  {
    type: 'DW-04',
    category: 'DW',
    label: 'Insight Synthesiser',
    description: 'Synthesises trends and anomalies from a dataset.',
    inputs: [inp('dataset', 'structured')],
    outputs: [out('insights', 'structured'), out('report', 'document')],
  },
  {
    type: 'DW-05',
    category: 'DW',
    label: 'Learner 360 Builder',
    description: 'Assembles a 360° learner profile from disparate signals.',
    inputs: [inp('signals', 'structured')],
    outputs: [out('profile360', 'structured')],
  },
];

// ─── Teaching & Learning Toolbox (TB) ────────────────────────────────────────

const TB_NODES: NodeDefinition[] = [
  {
    type: 'TB-01',
    category: 'TB',
    label: 'Worksheet Builder',
    description: 'Generates a differentiated worksheet with answer key.',
    inputs: [inp('topic', 'text'), inp('gradeLevel', 'structured', false)],
    outputs: [out('worksheet', 'document')],
  },
  {
    type: 'TB-03',
    category: 'TB',
    label: 'Reading Passage Generator',
    description: 'Creates a levelled reading passage with comprehension questions.',
    inputs: [inp('topic', 'text'), inp('readingLevel', 'structured', false)],
    outputs: [out('readingPassage', 'document')],
  },
  {
    type: 'TB-04',
    category: 'TB',
    label: 'Item Writer',
    description: 'Writes multiple-choice, short-answer and essay items.',
    inputs: [inp('topic', 'text'), inp('itemSpec', 'structured', false)],
    outputs: [out('items', 'document')],
  },
  {
    type: 'TB-05',
    category: 'TB',
    label: 'Memo & Marking Guide',
    description: 'Generates a memo and marking guide for an assessment.',
    inputs: [inp('assessment', 'document')],
    outputs: [out('memo', 'document')],
  },
  {
    type: 'TB-06',
    category: 'TB',
    label: 'Home-Language Adapter',
    description: "Adapts an artefact for a learner's home language.",
    inputs: [inp('artefact', 'document'), inp('targetLanguage', 'text')],
    outputs: [out('adaptedArtefact', 'document')],
  },
  {
    type: 'TB-07',
    category: 'TB',
    label: 'Accessibility Adapter',
    description: 'Adapts an artefact for learners with special needs (WCAG AA).',
    inputs: [inp('artefact', 'document'), inp('accessibilityProfile', 'structured')],
    outputs: [out('adaptedArtefact', 'document')],
  },
  {
    type: 'TB-08',
    category: 'TB',
    label: 'Remediation Pack Builder',
    description: 'Builds a targeted remediation pack for a specific gap.',
    inputs: [inp('gapAnalysis', 'structured')],
    outputs: [out('remediationPack', 'document')],
  },
  {
    type: 'TB-09',
    category: 'TB',
    label: 'Extension & Enrichment Agent',
    description: 'Creates extension and enrichment activities for advanced learners.',
    inputs: [inp('topic', 'text'), inp('gradeLevel', 'structured', false)],
    outputs: [out('extensionActivities', 'document')],
  },
  {
    type: 'TB-10',
    category: 'TB',
    label: 'Resource-Light Activity Agent',
    description: 'Designs activities that require minimal physical resources.',
    inputs: [inp('topic', 'text'), inp('constraints', 'structured', false)],
    outputs: [out('activities', 'document')],
  },
  {
    type: 'TB-11',
    category: 'TB',
    label: 'Visual Brief Writer',
    description: 'Writes a brief for an infographic, poster, diagram or chart.',
    inputs: [inp('topic', 'text'), inp('visualType', 'text')],
    outputs: [out('visualBrief', 'document')],
  },
];

// ─── PD Studio (PD) ───────────────────────────────────────────────────────────

const PD_NODES: NodeDefinition[] = [
  {
    type: 'PD-01',
    category: 'PD',
    label: 'Coverage vs Pacing Analyst',
    description: 'Analyses curriculum coverage versus planned pacing.',
    inputs: [inp('curriculumData', 'structured'), inp('teachingLog', 'structured')],
    outputs: [out('pacingAnalysis', 'structured'), out('report', 'document')],
  },
  {
    type: 'PD-02',
    category: 'PD',
    label: 'Assessment Quality Analyst',
    description: 'Evaluates the quality and alignment of assessments.',
    inputs: [inp('assessments', 'structured')],
    outputs: [out('qualityReport', 'document')],
  },
  {
    type: 'PD-03',
    category: 'PD',
    label: 'Observation Analyst',
    description: 'Analyses classroom observation trends over time.',
    inputs: [inp('observations', 'structured')],
    outputs: [out('trendReport', 'document')],
  },
  {
    type: 'PD-04',
    category: 'PD',
    label: 'Practice Signal Aggregator',
    description: 'Combines multiple teaching practice signals into a composite view.',
    inputs: [inp('signals', 'structured')],
    outputs: [out('compositeProfile', 'structured')],
  },
  {
    type: 'PD-05',
    category: 'PD',
    label: 'PD Gap Detector',
    description: 'Identifies professional development needs from practice signals.',
    inputs: [inp('compositeProfile', 'structured')],
    outputs: [out('pdGaps', 'structured')],
  },
  {
    type: 'PD-06',
    category: 'PD',
    label: 'Micro-Course Composer',
    description: 'Composes a targeted 15-minute micro-course for a specific PD gap.',
    inputs: [inp('pdGap', 'structured')],
    outputs: [out('microCourse', 'document')],
  },
  {
    type: 'PD-07',
    category: 'PD',
    label: 'Coaching Plan Agent',
    description: 'Creates a structured coaching plan for an educator.',
    inputs: [inp('pdGaps', 'structured'), inp('educatorProfile', 'structured')],
    outputs: [out('coachingPlan', 'document')],
  },
  {
    type: 'PD-08',
    category: 'PD',
    label: 'CPTD Tracker',
    description: 'Tracks SACE CPTD points and compliance for an educator.',
    inputs: [inp('activitiesLog', 'structured')],
    outputs: [out('cptdReport', 'document'), out('complianceStatus', 'signal')],
  },
];

// ─── Learning Engine (LE) ─────────────────────────────────────────────────────

const LE_NODES: NodeDefinition[] = [
  {
    type: 'LE-01',
    category: 'LE',
    label: 'Signal Collector',
    description: 'Collects learning signals from artefact usage and corrections.',
    inputs: [inp('artefactEvents', 'structured')],
    outputs: [out('signals', 'structured')],
  },
  {
    type: 'LE-02',
    category: 'LE',
    label: 'Correction Differ',
    description: 'Diffs corrections against original artefacts to find patterns.',
    inputs: [inp('original', 'document'), inp('corrected', 'document')],
    outputs: [out('correctionDiff', 'structured')],
  },
  {
    type: 'LE-04',
    category: 'LE',
    label: 'Pattern Miner',
    description: 'Mines success and failure patterns from a signal corpus.',
    inputs: [inp('signals', 'structured')],
    outputs: [out('patterns', 'structured')],
  },
  {
    type: 'LE-05',
    category: 'LE',
    label: 'Exemplar Curator',
    description: 'Curates high-quality artefact exemplars from the corpus.',
    inputs: [inp('artefactCorpus', 'structured')],
    outputs: [out('exemplars', 'structured')],
  },
  {
    type: 'LE-06',
    category: 'LE',
    label: 'Prompt Evolver',
    description: 'Proposes improved prompt versions based on correction signals.',
    inputs: [inp('currentPrompt', 'text'), inp('correctionSignals', 'structured')],
    outputs: [out('improvedPrompt', 'text'), out('changeSummary', 'document')],
  },
  {
    type: 'LE-07',
    category: 'LE',
    label: 'Eval Gatekeeper',
    description: 'Runs an eval set and decides whether a prompt change can promote.',
    inputs: [inp('promptCandidate', 'text'), inp('evalSetRef', 'text')],
    outputs: [out('evalReport', 'document'), out('canPromote', 'signal')],
  },
  {
    type: 'LE-08',
    category: 'LE',
    label: 'Commons Publisher',
    description: 'Publishes anonymised exemplars to the Commons pool.',
    inputs: [inp('exemplars', 'structured'), inp('consentVerified', 'signal')],
    outputs: [out('publishedCount', 'structured')],
  },
];

// ─── Branch nodes ─────────────────────────────────────────────────────────────

const BRANCH_NODES: NodeDefinition[] = [
  {
    type: 'Branch.condition',
    category: 'Branch',
    label: 'Condition',
    description: 'Routes to the "true" or "false" output based on a boolean signal.',
    inputs: [inp('condition', 'signal')],
    outputs: [
      out('true', 'signal', true, 'Taken when condition is true.'),
      out('false', 'signal', true, 'Taken when condition is false.'),
    ],
  },
  {
    type: 'Branch.filter',
    category: 'Branch',
    label: 'Filter',
    description: 'Passes structured data through only when a condition signal is true.',
    inputs: [inp('data', 'structured'), inp('condition', 'signal')],
    outputs: [out('filtered', 'structured')],
  },
  {
    type: 'Branch.merge',
    category: 'Branch',
    label: 'Merge',
    description: 'Merges two structured streams into one after a parallel split.',
    inputs: [inp('left', 'structured'), inp('right', 'structured')],
    outputs: [out('merged', 'structured')],
  },
  {
    type: 'Branch.loop',
    category: 'Branch',
    label: 'Loop',
    description: 'Iterates over a collection, emitting one item per iteration.',
    inputs: [inp('collection', 'structured')],
    outputs: [out('item', 'structured'), out('done', 'signal')],
  },
];

// ─── Gate nodes ───────────────────────────────────────────────────────────────

const GATE_NODES: NodeDefinition[] = [
  {
    type: 'Gate.approval',
    category: 'Gate',
    label: 'Approval Gate',
    description: 'Pauses the workflow until an authorised reviewer approves.',
    inputs: [inp('artefact', 'document'), inp('requiredRole', 'text')],
    outputs: [
      out(
        'approval',
        'approval',
        true,
        'The approval record (approver, timestamp, decision).',
      ),
      out('approved', 'signal'),
    ],
  },
  {
    type: 'Gate.review',
    category: 'Gate',
    label: 'Review Gate',
    description: 'Requests a structured review and collects feedback.',
    inputs: [inp('artefact', 'document')],
    outputs: [out('feedback', 'document'), out('approved', 'signal')],
  },
  {
    type: 'Gate.edit',
    category: 'Gate',
    label: 'Edit Gate',
    description: 'Allows a human to edit an artefact before the workflow continues.',
    inputs: [inp('draft', 'document')],
    outputs: [out('edited', 'document'), out('confirmed', 'signal')],
  },
];

// ─── Tool nodes ───────────────────────────────────────────────────────────────

const TOOL_NODES: NodeDefinition[] = [
  {
    type: 'Tool.database',
    category: 'Tool',
    label: 'Database Read',
    description: 'Reads structured data from the tenant-scoped data plane.',
    inputs: [inp('query', 'structured')],
    outputs: [out('result', 'structured')],
  },
  {
    type: 'Tool.api',
    category: 'Tool',
    label: 'API Call',
    description: 'Makes an HTTP call to an external or internal API.',
    inputs: [inp('request', 'structured')],
    outputs: [out('response', 'structured'), out('success', 'signal')],
  },
  {
    type: 'Tool.fileRead',
    category: 'Tool',
    label: 'File Read',
    description: 'Reads a file from object storage.',
    inputs: [inp('fileRef', 'text')],
    outputs: [out('content', 'document')],
  },
  {
    type: 'Tool.llm',
    category: 'Tool',
    label: 'LLM Call',
    description: 'Makes a direct call to the Model Gateway with a prompt.',
    inputs: [inp('prompt', 'text'), inp('context', 'structured', false)],
    outputs: [out('response', 'text')],
  },
];

// ─── Input / Output nodes ─────────────────────────────────────────────────────

const INPUT_OUTPUT_NODES: NodeDefinition[] = [
  {
    type: 'Input.text',
    category: 'Input',
    label: 'Text Input',
    description: 'Accepts a free-text string as workflow input.',
    inputs: [],
    outputs: [out('value', 'text')],
  },
  {
    type: 'Input.document',
    category: 'Input',
    label: 'Document Input',
    description: 'Accepts a document (lesson plan, assessment, etc.) as workflow input.',
    inputs: [],
    outputs: [out('value', 'document')],
  },
  {
    type: 'Input.structured',
    category: 'Input',
    label: 'Structured Input',
    description: 'Accepts a JSON-serialisable object as workflow input.',
    inputs: [],
    outputs: [out('value', 'structured')],
  },
  {
    type: 'Output.document',
    category: 'Output',
    label: 'Document Output',
    description: 'Emits a document as the workflow result.',
    inputs: [inp('value', 'document')],
    outputs: [],
  },
  {
    type: 'Output.text',
    category: 'Output',
    label: 'Text Output',
    description: 'Emits a text string as the workflow result.',
    inputs: [inp('value', 'text')],
    outputs: [],
  },
  {
    type: 'Output.structured',
    category: 'Output',
    label: 'Structured Output',
    description: 'Emits a structured object as the workflow result.',
    inputs: [inp('value', 'structured')],
    outputs: [],
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

/** The complete node definition catalogue (54+ types across 11 categories). */
export const NODE_DEFINITIONS: ReadonlyMap<string, NodeDefinition> = new Map(
  [
    ...CE_NODES,
    ...AC_NODES,
    ...DW_NODES,
    ...TB_NODES,
    ...PD_NODES,
    ...LE_NODES,
    ...BRANCH_NODES,
    ...GATE_NODES,
    ...TOOL_NODES,
    ...INPUT_OUTPUT_NODES,
  ].map((def) => [def.type, def]),
);

/** Returns the definition for a node type, or undefined if unknown. */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS.get(type);
}

/** Returns all definitions for a given category. */
export function getNodesByCategory(category: NodeCategory): NodeDefinition[] {
  return Array.from(NODE_DEFINITIONS.values()).filter((def) => def.category === category);
}
