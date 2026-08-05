// @infinite-ai/agents — Agent contract, registry and agent implementations.
//
// Step 1 (contract.ts) defines the one shape every agent declares: id, version, module,
// purpose, input/output schemas, prompt ref, logical model, tools, guardrails, budget,
// eval set ref, requiresApproval and writesToBrain — and the Zod validator that checks a
// candidate against it. Later steps in this stage add the registry that calls it at boot,
// the Prompt Registry, the DAG orchestrator, guardrail engine and run inspector.

export {
  AgentContract,
  AgentContractError,
  AgentModule,
  PromptRef,
  ToolSideEffect,
  validateAgentContract,
  type AgentBudget,
  type ToolDeclaration,
} from './contract.js';

export const PACKAGE_NAME = '@infinite-ai/agents' as const;
