# @infinite-ai/agent-builder

Visual agent workflow builder — design DAGs of agents, gates, branches and tools that
compile to `@infinite-ai/orchestrator` pipelines. This is the design-time editor; the
orchestrator is what actually runs a pipeline once built.

## What's here

- `workflow.ts` — `WorkflowGraph`/`WorkflowNode`/`WorkflowEdge`, and the operations a
  visual editor performs on one: `createWorkflow()`, `addNode()`/`removeNode()`,
  `addEdge()`/`removeEdge()`, `validateWorkflow()`, `exportWorkflow()`/`importWorkflow()`.
- `node-definitions.ts` — `NODE_DEFINITIONS`, the palette of node types a user can drag
  onto the canvas (agent call, tool call, human gate, branch, ...), each with its typed
  `PortDefinition`s.
- `edge-validation.ts` — `validateEdge()` / `findStaleEdges()`: whether a proposed
  connection between two ports is type-compatible, and which existing edges a graph edit
  has invalidated.
- `templates.ts` — `WORKFLOW_TEMPLATES`, starting-point graphs for common pipeline
  shapes.
- `monitoring.ts` — `WorkflowExecutionRecord` and `summariseExecution()`: the live
  run-state overlay on top of a graph while `@infinite-ai/orchestrator` executes it.

## Where it fits

Stage 19 (Visual Agent Builder) in `docs/STAGE_LOG.md`. Sits above L6 in the
`CLAUDE.md` architecture as a design-time tool: `workflow.ts`'s own header comment says
the execution-time equivalent of a `WorkflowGraph` lives in `@infinite-ai/orchestrator`
as a `PipelineDefinition`, translated by a `compile()` in `index.ts` — but as of this
README, no `compile()` exists anywhere in this package's source; the comment describes
intended, not built, behaviour. Until that translation exists, this package validates and
edits a design-time graph only — it does not yet produce anything `@infinite-ai/orchestrator`
can run.

## Running its tests

```bash
pnpm --filter @infinite-ai/agent-builder test
pnpm --filter @infinite-ai/agent-builder test:coverage
```

Unit tier only, no external services required.
