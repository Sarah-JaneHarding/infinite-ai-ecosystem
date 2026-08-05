// The Agent Registry — Stage 06 step 2.
//
// "A typed registry with a startup validation pass: unknown prompt ref, missing eval set,
// undeclared purpose, or absent budget is a boot failure, not a warning." Two of those four
// are already structural — `purpose` and `budget` are required fields on `AgentContract`
// (step 1), so a contract missing either never gets past `validateAgentContract` at all.
// This module adds the other two, plus the registry itself: a place every agent contract
// in the system is registered, once, with no duplicate id and no partial boot.
//
// "Unknown prompt ref" and "missing eval set" both name a lookup against a subsystem this
// stage has not built yet (the Prompt Registry, step 3) or that a later stage owns
// entirely (the eval harness, Stage 07) — the same forward reference `contract.ts`'s own
// header already named. Rather than fake either lookup or skip it, the registry takes the
// check as an injected function, defaulting to "assume it exists" until a real one is
// wired in — the same shape `apps/gateway/src/routing/router.ts` already uses for a
// logical model's routing entry: the mechanism is real now; what it is checked against
// arrives later.

import { validateAgentContract, type AgentContract, type PromptRef } from './contract.js';

export type PromptExistenceCheck = (ref: PromptRef) => boolean;
export type EvalSetExistenceCheck = (evalSetRef: string) => boolean;

const ASSUME_EXISTS = (): true => true;

export interface AgentRegistryOptions {
  /** Confirms a `promptRef` names a real, versioned prompt. Defaults to assuming every
   * referenced prompt exists — there is no Prompt Registry to check against yet (step 3);
   * a real caller supplies this once one does. */
  readonly promptExists?: PromptExistenceCheck;
  /** Confirms an `evalSetRef` names a real eval set. Defaults the same way, pending
   * Stage 07's eval harness. */
  readonly evalSetExists?: EvalSetExistenceCheck;
}

export class AgentRegistryError extends Error {
  public override readonly name = 'AgentRegistryError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * One process's set of registered agents. `id` is the primary key — never reused for a
 * different agent (`contract.ts`'s own comment on the field), so registering a second
 * contract under an id already present is refused rather than silently replacing it; an
 * agent's own `version` records how its contract has changed over time, not a second
 * agent coexisting under the same id.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentContract>();
  private readonly promptExists: PromptExistenceCheck;
  private readonly evalSetExists: EvalSetExistenceCheck;

  constructor(options: AgentRegistryOptions = {}) {
    this.promptExists = options.promptExists ?? ASSUME_EXISTS;
    this.evalSetExists = options.evalSetExists ?? ASSUME_EXISTS;
  }

  /**
   * Validates and registers one agent contract. Throws `AgentContractError` for a
   * structurally invalid candidate (step 1's own check), or `AgentRegistryError` for a
   * duplicate id, an unknown prompt ref, or a missing eval set — never registers
   * partially: a throw here means nothing was added.
   */
  register(candidate: unknown): AgentContract {
    const contract = validateAgentContract(candidate);

    if (this.agents.has(contract.id)) {
      throw new AgentRegistryError(
        `Agent "${contract.id}" is already registered. An id is never reused for a ` +
          'different agent, and a version change is not a second agent.',
      );
    }
    if (!this.promptExists(contract.promptRef)) {
      throw new AgentRegistryError(
        `Agent "${contract.id}" references unknown prompt ` +
          `"${contract.promptRef.agent}@${contract.promptRef.version}".`,
      );
    }
    if (!this.evalSetExists(contract.evalSetRef)) {
      throw new AgentRegistryError(
        `Agent "${contract.id}" references unknown eval set "${contract.evalSetRef}".`,
      );
    }

    this.agents.set(contract.id, contract);
    return contract;
  }

  get(id: string): AgentContract | undefined {
    return this.agents.get(id);
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  list(): readonly AgentContract[] {
    return [...this.agents.values()];
  }
}

/**
 * The startup validation pass itself: registers every candidate in order and throws on
 * the first one that fails, for whatever reason — "a boot failure, not a warning." A
 * caller that wants to boot successfully must fix the invalid agent, not catch this and
 * continue with the rest partially registered.
 */
export function bootAgentRegistry(
  candidates: readonly unknown[],
  options: AgentRegistryOptions = {},
): AgentRegistry {
  const registry = new AgentRegistry(options);
  for (const candidate of candidates) {
    registry.register(candidate);
  }
  return registry;
}
