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

export const PACKAGE_NAME = '@infinite-ai/agents' as const;
