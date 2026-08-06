// The agent executor registry — Stage 07 step 5.
//
// The CI gate (`evals:run`/`evals:gate`) needs to know how to actually call each agent it
// finds a golden set for. Nothing in this build has a real agent implementation yet
// (Stage 08 is the first module), so this is deliberately just a registration point — the
// same "mechanism now, real wiring once the source exists" shape `AgentRegistry`
// (`packages/agents`) already uses for `promptExists`/`evalSetRef`. A module that
// registers a real agent later calls `registerAgentExecutor` once, at its own boot time;
// this file never imports a module's own code, so registering here creates no dependency
// cycle back into any module.

import type { AgentExecutor } from './runner.js';

const executors = new Map<string, AgentExecutor>();

export class AgentExecutorRegistryError extends Error {
  public override readonly name = 'AgentExecutorRegistryError';
  constructor(message: string) {
    super(message);
  }
}

/** Registers `executor` for `agentId`. Refuses a second registration for the same id — a
 * silently-overwritten executor would make "which implementation actually ran" impossible
 * to answer after the fact. */
export function registerAgentExecutor(agentId: string, executor: AgentExecutor): void {
  if (executors.has(agentId)) {
    throw new AgentExecutorRegistryError(
      `An executor is already registered for agent "${agentId}".`,
    );
  }
  executors.set(agentId, executor);
}

export function getAgentExecutor(agentId: string): AgentExecutor | undefined {
  return executors.get(agentId);
}

export function registeredAgentIds(): readonly string[] {
  return [...executors.keys()].sort();
}

/** Test-only escape hatch: the registry is process-wide module state, and a test suite
 * that registers an executor needs a way to undo it without leaking into the next test
 * file's own run. Not exported from the package's own `index.ts` for that reason — nothing
 * outside a test should ever need to clear a real registration. */
export function _clearAgentExecutorRegistry(): void {
  executors.clear();
}
