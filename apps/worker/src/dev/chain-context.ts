// Dev-only chaining and grounding for MOD-01 (decision: OQ-030, option C).
//
// In production, an agent call sends the step's input and nothing else. The MOD-01 prompts,
// though, are written to receive `{ input, context }` where `context` carries the L0 source
// documents and the artefacts earlier agents produced (`framework`, `termPlan`, ...), and
// they treat any artefact with `ratifiedAt: null` as absent. A run has one human gate, at
// the end, so inside a run those artefacts are drafts. This module therefore does two things,
// only for `pnpm dev:run-pipeline --chain`:
//
//   1. GROUNDING - attach the ratified L0 documents each agent's executor already attaches
//      (`packages/curriculum-seed`), under the key names the prompts use.
//   2. CHAINING - attach the drafts earlier agents produced in this same run, labelled
//      provisional, plus a system-prompt addendum telling the model that for this
//      calibration run it may use provisional artefacts.
//
// Nothing here ratifies anything: no `ratifiedAt` is ever set, the drafts are never written
// as ratified, and the HoD gate still decides. Production prompts and pipelines are
// untouched. Which context each agent receives is data (`CHAIN_SPECS`), read top to bottom.

import type {
  ConstitutionRow,
  OrchestratorStepRunRow,
  TenantClient,
} from '@infinite-ai/db';
import { listEffectiveConstitution, listStepRuns } from '@infinite-ai/db';
import type { PipelineDefinition } from '@infinite-ai/orchestrator';

import type { AgentPayloadBuilder } from '../step-executor.js';

type ConstitutionKind = ConstitutionRow['kind'];

interface UpstreamSpec {
  /** The `context` key the prompt reads. */
  readonly key: string;
  /** The agent whose output supplies it. */
  readonly from: string;
  /** The field of that agent's `status: 'ok'` result that holds the artefact. */
  readonly artefact: string;
  /** Input fields that must be equal for a producing item to feed this consumer item. When
   * present, every matching producer is eligible (one: singular key; several: plural key). */
  readonly match?: readonly string[];
}

interface ChainSpec {
  /** `context.l0Documents`: the ratified L0 rows of these kinds. */
  readonly l0Documents?: readonly ConstitutionKind[];
  /** Further named L0 groups, e.g. `assessmentPolicy`. */
  readonly l0Named?: readonly {
    readonly key: string;
    readonly kinds: readonly ConstitutionKind[];
  }[];
  readonly upstream: readonly UpstreamSpec[];
}

/** What each MOD-01 agent's prompt GROUNDING section asks for. Agents not listed here are
 * sent exactly what production sends. Extending chaining to another module is a new row. */
export const CHAIN_SPECS: Readonly<Record<string, ChainSpec>> = {
  'CE-01': { l0Documents: ['CAPS_CANON'], upstream: [] },
  'CE-02': {
    l0Documents: ['CAPS_CANON', 'ATP_CALENDAR'],
    upstream: [{ key: 'framework', from: 'CE-01', artefact: 'framework' }],
  },
  'CE-03': {
    l0Documents: ['CAPS_CANON', 'ATP_CALENDAR', 'ASSESSMENT_POLICY'],
    l0Named: [{ key: 'assessmentPolicy', kinds: ['ASSESSMENT_POLICY'] }],
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      { key: 'atpSchedule', from: 'CE-02', artefact: 'schedule' },
    ],
  },
  'CE-04': {
    l0Documents: ['CAPS_CANON'],
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      { key: 'termPlan', from: 'CE-03', artefact: 'plan' },
    ],
  },
  'CE-05': {
    l0Documents: ['CAPS_CANON', 'TEMPLATE'],
    l0Named: [{ key: 'templateDefinition', kinds: ['TEMPLATE'] }],
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      {
        key: 'unitBlueprint',
        from: 'CE-04',
        artefact: 'blueprint',
        match: ['subject', 'termNumber'],
      },
    ],
  },
  'CE-06': {
    l0Named: [{ key: 'assessmentPolicy', kinds: ['ASSESSMENT_POLICY'] }],
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      { key: 'termPlan', from: 'CE-03', artefact: 'plan' },
    ],
  },
  'CE-07': {
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      {
        key: 'assessmentTask',
        from: 'CE-06',
        artefact: 'task',
        match: ['subject', 'taskKind'],
      },
    ],
  },
  'CE-08': {
    upstream: [
      { key: 'framework', from: 'CE-01', artefact: 'framework' },
      {
        key: 'lessonPlan',
        from: 'CE-05',
        artefact: 'plan',
        match: ['subject', 'weekNumber', 'termNumber'],
      },
    ],
  },
  'CE-09': { upstream: [{ key: 'termPlan', from: 'CE-03', artefact: 'plan' }] },
};

/** Appended to the system prompt in `--chain` mode only. */
export const DEV_CHAIN_ADDENDUM =
  'CALIBRATION RUN (development only). Artefacts listed in `context.devChain.provisionalArtefacts` ' +
  'were produced earlier in this same run and have not yet been ratified by a person; their ' +
  '`ratifiedAt` is null. For this run only, treat them as present and usable instead of as ' +
  'absent, and say in your output that they are provisional where it matters. Artefacts in ' +
  '`context.devChain.devSupplied` were supplied by the developer for testing. Every other ' +
  'rule in this prompt still applies: do not invent curriculum values, cite your sources, ' +
  'return `needs_input` for anything genuinely missing (see `context.devChain.missingUpstream`), ' +
  'and never set `ratifiedAt` on your own output.';

export interface StepRunLike {
  readonly stepId: string;
  readonly status: string;
  readonly input: unknown;
  readonly output: unknown;
}

export interface ChainContext {
  readonly context: Record<string, unknown>;
  readonly provisional: readonly string[];
  readonly missing: readonly string[];
}

const ITEM_SUFFIX = /\[\d+\]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function producersOf(
  agentId: string,
  stepRuns: readonly StepRunLike[],
  pipeline: PipelineDefinition,
): readonly StepRunLike[] {
  return stepRuns.filter((row) => {
    if (row.status !== 'SUCCEEDED') return false;
    const step = pipeline.steps[row.stepId.replace(ITEM_SUFFIX, '')];
    return step?.kind === 'agent_call' && step.agentId === agentId;
  });
}

function artefactOf(row: StepRunLike, field: string): unknown {
  if (!isRecord(row.output) || row.output['status'] !== 'ok') return undefined;
  return row.output[field];
}

export function assembleChainContext(args: {
  readonly agentId: string;
  readonly input: unknown;
  readonly stepRuns: readonly StepRunLike[];
  readonly pipeline: PipelineDefinition;
  readonly constitution: readonly Pick<ConstitutionRow, 'kind'>[];
  /** Developer-supplied context (`--context-file`); wins over everything else. */
  readonly extra?: Readonly<Record<string, unknown>>;
}): ChainContext | null {
  const spec = CHAIN_SPECS[args.agentId];
  if (spec === undefined) return null;

  const context: Record<string, unknown> = {};
  const provisional: string[] = [];
  const missing: string[] = [];

  const ofKinds = (kinds: readonly ConstitutionKind[]): readonly unknown[] =>
    args.constitution.filter((row) => kinds.includes(row.kind));
  if (spec.l0Documents !== undefined) context['l0Documents'] = ofKinds(spec.l0Documents);
  for (const named of spec.l0Named ?? []) context[named.key] = ofKinds(named.kinds);

  for (const up of spec.upstream) {
    const found = producersOf(up.from, args.stepRuns, args.pipeline)
      .filter((row) => {
        if (up.match === undefined) return true;
        const mine = isRecord(args.input) ? args.input : {};
        const theirs = isRecord(row.input) ? row.input : {};
        return up.match.every(
          (field) =>
            !(field in mine) ||
            !(field in theirs) ||
            JSON.stringify(mine[field]) === JSON.stringify(theirs[field]),
        );
      })
      .map((row) => artefactOf(row, up.artefact))
      .filter((artefact) => artefact !== undefined);

    if (found.length === 0) {
      missing.push(up.key);
    } else if (up.match !== undefined && found.length > 1) {
      context[`${up.key}s`] = found;
      provisional.push(`${up.key}s`);
    } else {
      context[up.key] = found[found.length - 1];
      provisional.push(up.key);
    }
  }

  const devSupplied = Object.keys(args.extra ?? {});
  Object.assign(context, args.extra ?? {});
  for (const key of devSupplied) {
    const at = missing.indexOf(key);
    if (at !== -1) missing.splice(at, 1);
  }
  context['devChain'] = {
    provisionalArtefacts: provisional,
    missingUpstream: missing,
    devSupplied,
  };
  return { context, provisional, missing };
}

/** The impure half: reads the run's step history and L0 inside the job's own transaction
 * (rule 5) and hands each agent its assembled context. */
export function makeChainPayloadBuilder(args: {
  readonly tx: TenantClient;
  readonly runId: string;
  readonly pipeline: PipelineDefinition;
  readonly extra?: Readonly<Record<string, unknown>>;
}): AgentPayloadBuilder {
  let constitution: readonly ConstitutionRow[] | undefined;
  return async ({ agentId, input }) => {
    if (CHAIN_SPECS[agentId] === undefined) return { userContent: input };
    constitution ??= await listEffectiveConstitution(args.tx);
    const stepRuns: readonly OrchestratorStepRunRow[] = await listStepRuns(
      args.tx,
      args.runId,
    );
    const assembled = assembleChainContext({
      agentId,
      input,
      stepRuns,
      pipeline: args.pipeline,
      constitution,
      ...(args.extra === undefined ? {} : { extra: args.extra }),
    });
    if (assembled === null) return { userContent: input };
    return {
      userContent: { input, context: assembled.context },
      systemSuffix: DEV_CHAIN_ADDENDUM,
    };
  };
}

/** For a single agent run (`dev:run-agent --context-file`): send `{ input, context }` with the
 * developer's own context, labelled as developer-supplied, and the same calibration addendum. */
export function staticContextBuilder(
  context: Readonly<Record<string, unknown>>,
): AgentPayloadBuilder {
  return async ({ input }) => ({
    userContent: {
      input,
      context: {
        ...context,
        devChain: {
          provisionalArtefacts: [],
          missingUpstream: [],
          devSupplied: Object.keys(context),
        },
      },
    },
    systemSuffix: DEV_CHAIN_ADDENDUM,
  });
}
