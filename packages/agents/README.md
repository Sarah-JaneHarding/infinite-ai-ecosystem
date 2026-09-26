# @infinite-ai/agents

The agent contract, the agent registry, and every agent implementation itself — one
declaration per agent (`CE-01`…`CE-09`, `AC-01`…`AC-10`, `DW-01`…`DW-08`,
`TB-01`…`TB-11`, `PD-01`…`PD-08`, `LE-01`…`LE-09`), grouped by module (MOD-01 through
MOD-05, plus the Learning Engine's `le/`).

## What's here

- `contract.ts` — `AgentContract`, the one shape every agent declares: id, version,
  module, purpose, input/output schemas, prompt ref, logical model, tools, guardrails,
  budget, eval set ref, `requiresApproval`, and `writesToBrain`. `validateAgentContract()`
  is the Zod validator every declaration is checked against.
- `registry.ts` — `AgentRegistry` / `bootAgentRegistry()`: the startup validation pass
  that registers every agent, refuses a duplicate id, and refuses an unknown prompt ref
  or a missing eval set — checked against `@infinite-ai/prompts` and `@infinite-ai/evals`
  respectively.
- `tool-registry.ts` — `ToolRegistry` / `bootToolRegistry()`, the parallel registry for
  the tools an agent is allowed to declare.
- `mod-01/` … `mod-05/`, `le/` — each agent's own `*.contract.ts` declaration, one file
  per agent, grouped by the module it belongs to.

## Where it fits

L6 (the agent runtime) in the `CLAUDE.md` architecture, alongside
`packages/orchestrator` and `packages/prompts`. `bootAgentRegistry()` can check that a
declared prompt ref and eval set ref actually _exist_, via a `PromptExistenceCheck` /
`EvalSetExistenceCheck` its caller supplies — but as of this README, no application code
(`apps/worker`, `apps/gateway`) calls `bootAgentRegistry()` at all, so those checks
default to assuming every ref exists and never actually run against real data yet. The
≥ 20-case minimum and cost-budget correctness are Definition-of-Done conventions a
reviewer checks; neither is enforced by this package's code.

## Running its tests

```bash
pnpm --filter @infinite-ai/agents test
```

Unit tier only — validates contract shape and registry behaviour, not live model calls.
