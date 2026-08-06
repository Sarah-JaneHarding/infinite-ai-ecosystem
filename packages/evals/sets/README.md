# Golden sets

One subdirectory per agent id, one or more `*.json` files per subdirectory, each holding a
JSON array of `EvalCase` objects (`packages/evals/src/case.ts`). Loaded by
`loadAllEvalSets`/`loadEvalCasesFromDir` (Stage 07 step 5) and validated the same way every
other contract in this codebase is — a malformed case fails the moment it is discovered,
not partway through a run.

Empty today: no module has a real agent yet (Stage 08 is the first). The loader, the CI
gate (`pnpm evals:gate`) and the manual runner (`pnpm evals:run --all`) are all wired for
real against this directory regardless — the moment a module adds
`packages/evals/sets/<agent-id>/*.json` and registers a real `AgentExecutor`
(`registerAgentExecutor`), both commands start doing real work with no further wiring
needed.

Example shape for `packages/evals/sets/CE-05/lesson-planning.json`:

```json
[
  {
    "id": "ce-05-fractions-001",
    "agentId": "CE-05",
    "input": { "topic": "fractions", "grade": 6 },
    "context": { "retrievedFacts": ["caps-math-g6-fractions"] },
    "expectations": [{ "type": "exact_match", "field": "status", "value": "ok" }],
    "tags": [],
    "source": "specification"
  }
]
```
