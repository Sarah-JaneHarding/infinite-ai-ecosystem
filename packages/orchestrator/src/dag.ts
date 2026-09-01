// The typed DAG declaration — Stage 06 step 4.
//
// "Pipelines are declared as typed DAGs of steps (agent call, tool call, human gate,
// branch, map-over-collection, compensation)." A pipeline is a map of step id to step,
// plus one entry point; every step but `branch` points at its single successor by id
// (`next`), so the *forward* graph a run actually walks is a chain with branch points —
// enough to express the manual's own reference pipeline ("three agents, one human gate,
// one compensation path") without building a general fan-in/fan-out graph engine nothing
// in this stage's own exit gate asks for.
//
// Compensation is deliberately not part of that forward graph. A `compensatesWith` on a
// forward step names a `compensation` step to run if a *later* step fails after this one
// already succeeded — triggered by the runner on failure (`run-state-machine.ts`'s
// `compensationChain`), never reached by walking `next` in the normal direction.

import { z } from 'zod';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const SEMVER_MESSAGE = 'version must be a semver string (x.y.z)';

export const StepKind = z.enum([
  'agent_call',
  'tool_call',
  'human_gate',
  'branch',
  'map',
  'compensation',
]);
export type StepKind = z.infer<typeof StepKind>;

const StepCommon = {
  id: z.string().min(1),
  timeoutMs: z.number().int().positive(),
  maxRetries: z.number().int().min(0),
  /** The `compensation` step to run if a later step fails after this one succeeds. Null
   * for a step with nothing to undo. */
  compensatesWith: z.string().min(1).nullable(),
};

const AgentCallStep = z.object({
  ...StepCommon,
  kind: z.literal('agent_call'),
  agentId: z.string().min(1),
  next: z.string().min(1).nullable(),
});

const ToolCallStep = z.object({
  ...StepCommon,
  kind: z.literal('tool_call'),
  toolName: z.string().min(1),
  next: z.string().min(1).nullable(),
});

/** Pauses the run — "the run blocks" (step 5's own text). The approval task itself, the
 * diff, the evidence and the required-role enforcement are step 5's job; this step kind
 * only marks the point in the pipeline where that happens. */
const HumanGateStep = z.object({
  ...StepCommon,
  kind: z.literal('human_gate'),
  requiredRole: z.string().min(1),
  next: z.string().min(1).nullable(),
});

/** `condition` names a fact the runner evaluates externally (an injected evaluator, the
 * same "mechanism now, real check wired later" shape `@infinite-ai/agents`' registry
 * already uses for `promptExists`/`evalSetExists`) — this schema only records where each
 * branch of the decision leads. */
const BranchStep = z.object({
  ...StepCommon,
  kind: z.literal('branch'),
  condition: z.string().min(1),
  onTrue: z.string().min(1),
  onFalse: z.string().min(1),
});

/** Applies `itemStepId` once per item of the collection found at `collectionField` on
 * this step's input, then continues to `next` once every item's run has settled. */
const MapStep = z.object({
  ...StepCommon,
  kind: z.literal('map'),
  itemStepId: z.string().min(1),
  collectionField: z.string().min(1),
  next: z.string().min(1).nullable(),
});

/** What undoes `compensatesStepId`'s effect. Never reached by a forward `next` edge — the
 * runner invokes it directly when compensation is triggered. */
const CompensationStep = z.object({
  ...StepCommon,
  kind: z.literal('compensation'),
  compensatesStepId: z.string().min(1),
  agentId: z.string().min(1).nullable(),
  toolName: z.string().min(1).nullable(),
});

export const PipelineStep = z.discriminatedUnion('kind', [
  AgentCallStep,
  ToolCallStep,
  HumanGateStep,
  BranchStep,
  MapStep,
  CompensationStep,
]);
export type PipelineStep = z.infer<typeof PipelineStep>;

export const PipelineDefinition = z.object({
  id: z.string().min(1),
  version: z.string().regex(SEMVER_PATTERN, SEMVER_MESSAGE),
  entryStepId: z.string().min(1),
  steps: z.record(z.string(), PipelineStep),
});
export type PipelineDefinition = z.infer<typeof PipelineDefinition>;

export class PipelineDagError extends Error {
  public override readonly name = 'PipelineDagError';
  constructor(message: string) {
    super(message);
  }
}

/** Every step id a step's own declaration points at going forward — `compensatesWith`
 * excluded, since that edge runs backward and only on failure, never as part of the
 * pipeline's normal forward walk. */
function forwardTargets(step: PipelineStep): readonly string[] {
  switch (step.kind) {
    case 'agent_call':
    case 'tool_call':
    case 'human_gate':
    case 'map':
      return step.next === null ? [] : [step.next];
    case 'branch':
      return [step.onTrue, step.onFalse];
    case 'compensation':
      return [];
  }
}

/**
 * Validates a pipeline's own structural integrity: every id a step references — `next`,
 * `onTrue`/`onFalse`, `itemStepId`, `compensatesStepId`, `compensatesWith` — resolves to a
 * real step in the same pipeline, the entry point exists, and the forward graph has no
 * cycle. A `map` step's `itemStepId` and every step's `compensatesWith` are checked for
 * existence but not walked as part of the cycle check: a nested or compensating step is
 * invoked directly by the runner, not reached by walking `next`.
 */
export function validatePipelineDag(pipeline: PipelineDefinition): void {
  const { steps, entryStepId, id } = pipeline;

  if (!(entryStepId in steps)) {
    throw new PipelineDagError(
      `Pipeline "${id}": entryStepId "${entryStepId}" is not a declared step.`,
    );
  }

  for (const step of Object.values(steps)) {
    const referenced: string[] = [...forwardTargets(step)];
    if (step.kind === 'map') referenced.push(step.itemStepId);
    if (step.kind === 'compensation') referenced.push(step.compensatesStepId);
    if (step.compensatesWith !== null) referenced.push(step.compensatesWith);

    for (const targetId of referenced) {
      if (!(targetId in steps)) {
        throw new PipelineDagError(
          `Pipeline "${id}": step "${step.id}" references unknown step "${targetId}".`,
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stepId: string): void => {
    if (visited.has(stepId)) return;
    if (visiting.has(stepId)) {
      throw new PipelineDagError(
        `Pipeline "${id}": cycle detected in the forward step graph at "${stepId}".`,
      );
    }
    visiting.add(stepId);
    const step = steps[stepId];
    if (step !== undefined) {
      for (const targetId of forwardTargets(step)) visit(targetId);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  };
  visit(entryStepId);
}

/**
 * The step whose forward edge (`next`, or a `branch`'s `onTrue`/`onFalse`) points at
 * `stepId` — what a `branch` step's condition reads its input from (OQ-024: a condition
 * evaluates the specific prior step it is narrated against, e.g. "AC-02's
 * output.status", never the run's own static input). Returns `null` for the pipeline's
 * entry step, which has no predecessor. Throws if more than one step points at `stepId`:
 * a condition needs exactly one unambiguous prior step to read output from, so an
 * ambiguous target is a pipeline authoring error, not something for the runner to guess
 * between.
 */
export function findPredecessorStepId(
  pipeline: PipelineDefinition,
  stepId: string,
): string | null {
  const predecessors = Object.values(pipeline.steps)
    .filter((step) => forwardTargets(step).includes(stepId))
    .map((step) => step.id);

  if (predecessors.length > 1) {
    throw new PipelineDagError(
      `Pipeline "${pipeline.id}": step "${stepId}" has more than one predecessor ` +
        `(${predecessors.join(', ')}) — a branch condition needs exactly one.`,
    );
  }
  return predecessors[0] ?? null;
}

export type IrreversibleToolCheck = (toolName: string) => boolean;

/**
 * "`irreversible` tools always require a human gate" (Stage 06 step 7) — checked here, not
 * as part of `validatePipelineDag`, since it needs to know which named tools are
 * irreversible and `validatePipelineDag`'s own callers (this file's own tests included)
 * have no reason to supply that. Assumes `pipeline` already passed `validatePipelineDag`.
 *
 * The check: walk forward from `entryStepId`, but never propagate *past* a `human_gate`
 * step — everything reachable that way is reachable by at least one path with no approval
 * in front of it. If an irreversible `tool_call` step is in that set, some path reaches it
 * ungated, which is exactly what the rule forbids — even if a *different* path to the same
 * step happens to pass through a gate first.
 *
 * Deliberately scoped to the forward graph only: a `compensation` step's own tool call is
 * invoked directly by the runner during rollback, never reached by walking `next`, and is
 * out of scope for this structural check — whether an irreversible compensation needs its
 * own gate is a design question this step's own text does not address, not something to
 * guess at here.
 */
export function validatePipelineGating(
  pipeline: PipelineDefinition,
  isIrreversibleTool: IrreversibleToolCheck,
): void {
  const { steps, entryStepId, id } = pipeline;

  const reachableWithoutGate = new Set<string>();
  const queue: string[] = [entryStepId];
  while (queue.length > 0) {
    const stepId = queue.shift()!;
    if (reachableWithoutGate.has(stepId)) continue;
    reachableWithoutGate.add(stepId);

    const step = steps[stepId];
    if (step === undefined || step.kind === 'human_gate') continue; // a gate blocks propagation past it

    for (const targetId of forwardTargets(step)) {
      if (!reachableWithoutGate.has(targetId)) queue.push(targetId);
    }
  }

  for (const stepId of reachableWithoutGate) {
    const step = steps[stepId];
    if (step?.kind === 'tool_call' && isIrreversibleTool(step.toolName)) {
      throw new PipelineDagError(
        `Pipeline "${id}": step "${step.id}" calls irreversible tool "${step.toolName}" ` +
          'reachable by at least one path with no human_gate in front of it.',
      );
    }
  }
}
