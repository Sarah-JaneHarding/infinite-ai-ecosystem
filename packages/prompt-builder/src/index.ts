// Public API — Stage 20 (Master Prompt Builder).

export { PromptBuildError, buildPrompt } from './builder.js';

export type { BuiltPrompt } from './builder.js';

export {
  DEFAULT_BUDGET,
  CHARS_PER_TOKEN,
  PromptBudget,
  PromptBudgetError,
  enforceBudget,
  estimateTokens,
} from './budget.js';

export {
  PromptVariableError,
  VariableName,
  extractVariables,
  substituteVariables,
} from './variables.js';

export type { VariableMap } from './variables.js';
