// @infinite-ai/orchestrator — DAG definitions, durable runner, human gates, compensation.
//
// Stage 06 step 4. `dag.ts` declares a pipeline as a typed DAG of steps (agent call, tool
// call, human gate, branch, map-over-collection, compensation) and validates its own
// structural integrity (every reference resolves, no cycle in the forward graph).
// `run-state-machine.ts` is the pure decision logic a run's lifecycle needs: retry delay
// with jitter, timeout detection, the next step after a success, and which compensations
// a failure triggers, in what order. `runner.ts` is the imperative shell that persists
// every decision through `@infinite-ai/db` and actually calls out to execute a step —
// durable and resumable because nothing it needs survives only in memory between calls.

export {
  PipelineDagError,
  PipelineDefinition,
  PipelineStep,
  StepKind,
  validatePipelineDag,
} from './dag.js';

export {
  OrchestratorError,
  compensationChain,
  computeRetryDelayMs,
  hasTimedOut,
  nextStepAfterSuccess,
  shouldRetry,
  type RunStatus,
  type StepRunStatus,
} from './run-state-machine.js';

export {
  OrchestratorRunnerError,
  advanceRun,
  cancelRun,
  decideHumanGate,
  runToCompletion,
  startRun,
  type ApprovalMaterial,
  type ApprovalMaterialProvider,
  type ConditionEvaluator,
  type HumanGateContext,
  type HumanGateDecisionInput,
  type RunnerOptions,
  type StepExecutionContext,
  type StepExecutor,
} from './runner.js';

export const PACKAGE_NAME = '@infinite-ai/orchestrator' as const;
