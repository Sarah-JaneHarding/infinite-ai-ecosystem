# @infinite-ai/prompt-builder

Master Prompt Builder — assembles a versioned `@infinite-ai/prompts` registry entry into
a gateway-ready request: variable substitution, section splitting, and token budget
enforcement.

## What's here

- `variables.ts` — `extractVariables()`/`substituteVariables()`: every `{{placeholder}}`
  in a prompt body must have a supplied value (missing) and every supplied value must
  match a real placeholder (unknown/typo guard) — `PromptVariableError` carries both
  lists. `VariableName` is the exported schema a caller validates a variable name
  against directly.
- `budget.ts` — `estimateTokens()` (a conservative 4-chars-per-token estimate) and
  `enforceBudget()`, throwing `PromptBudgetError` (with the offending section, estimated
  tokens, and the max) when either side of the split exceeds its budget. `PromptBudget`
  is the exported schema for an untrusted budget config.
- `builder.ts` — `buildPrompt()`: substitutes variables, splits the eight mandatory
  sections into `system` (ROLE, HARD CONSTRAINTS, STYLE, REFUSAL, OUTPUT SCHEMA,
  SELF-CHECK) and `userTurn` (GROUNDING, TASK), enforces the budget, and returns a
  `BuiltPrompt` with `source` set to `<agent>@<version>`.

## Where it fits

An L6 (agent runtime) package. `@infinite-ai/prompts` loads a prompt file; this package
turns it into the two strings the gateway needs;
`@infinite-ai/system-prompt-builder` wraps the result with platform-level identity and
tenant context before it becomes a real `ChatCompletionRequest`.

## Running its tests

```bash
pnpm --filter @infinite-ai/prompt-builder test
pnpm --filter @infinite-ai/prompt-builder test:coverage
```

Unit tier only, no model calls.
