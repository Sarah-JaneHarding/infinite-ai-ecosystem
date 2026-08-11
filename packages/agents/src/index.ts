// @infinite-ai/agents — Agent contract, registry and agent implementations.
//
// Step 1 (contract.ts) defines the one shape every agent declares: id, version, module,
// purpose, input/output schemas, prompt ref, logical model, tools, guardrails, budget,
// eval set ref, requiresApproval and writesToBrain — and the Zod validator that checks a
// candidate against it. Step 2 (registry.ts) adds the registry: the startup validation
// pass that registers every agent, refuses a duplicate id, and — once the Prompt Registry
// (step 3) and eval harness (Stage 07) exist to check against — refuses an unknown prompt
// ref or a missing eval set too. Later steps add the Prompt Registry itself, the DAG
// orchestrator, guardrail engine and run inspector.

export {
  AgentContract,
  AgentContractError,
  AgentModule,
  PromptRef,
  ToolDeclaration,
  ToolSideEffect,
  validateAgentContract,
  type AgentBudget,
} from './contract.js';

export {
  AgentRegistry,
  AgentRegistryError,
  bootAgentRegistry,
  type AgentRegistryOptions,
  type EvalSetExistenceCheck,
  type PromptExistenceCheck,
} from './registry.js';

export { ToolRegistry, ToolRegistryError, bootToolRegistry } from './tool-registry.js';

export { CE01Contract } from './mod-01/CE-01.contract.js';
export { CE02Contract } from './mod-01/CE-02.contract.js';
export { CE03Contract } from './mod-01/CE-03.contract.js';
export { CE04Contract } from './mod-01/CE-04.contract.js';
export { CE05Contract } from './mod-01/CE-05.contract.js';
export { CE06Contract } from './mod-01/CE-06.contract.js';
export { CE07Contract } from './mod-01/CE-07.contract.js';
export { CE08Contract } from './mod-01/CE-08.contract.js';
export { CE09Contract } from './mod-01/CE-09.contract.js';

export { AC01Contract } from './mod-02/AC-01.contract.js';
export { AC02Contract } from './mod-02/AC-02.contract.js';

export { DW01Contract } from './mod-03/DW-01.contract.js';
export { DW02Contract } from './mod-03/DW-02.contract.js';
export { DW03Contract } from './mod-03/DW-03.contract.js';
export { DW04Contract } from './mod-03/DW-04.contract.js';
export { DW05Contract } from './mod-03/DW-05.contract.js';
export { DW06Contract } from './mod-03/DW-06.contract.js';
export { DW07Contract } from './mod-03/DW-07.contract.js';
export { DW08Contract } from './mod-03/DW-08.contract.js';

export { TB01Contract } from './mod-04/TB-01.contract.js';
export { TB03Contract } from './mod-04/TB-03.contract.js';
export { TB04Contract } from './mod-04/TB-04.contract.js';
export { TB05Contract } from './mod-04/TB-05.contract.js';
export { TB06Contract } from './mod-04/TB-06.contract.js';
export { TB07Contract } from './mod-04/TB-07.contract.js';
export { TB08Contract } from './mod-04/TB-08.contract.js';
export { TB09Contract } from './mod-04/TB-09.contract.js';

export const PACKAGE_NAME = '@infinite-ai/agents' as const;
