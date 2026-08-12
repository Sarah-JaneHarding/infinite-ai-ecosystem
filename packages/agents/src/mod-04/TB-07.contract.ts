// TB-07 Accessibility Adapter — Stage 11 step 4.
//
// Adapts a source artefact for one of four accessibility modes: LARGE_PRINT,
// DYSLEXIA_FRIENDLY, SIMPLIFIED_LANGUAGE, or BRAILLE_READY.
// Every adapted artefact is validated against mode-specific accessibility checks
// before the result is returned. A failing check produces
// 'accessibility_check_failed' rather than silently delivering an unchecked output.

import { TB07Input, TB07Result } from '@infinite-ai/contracts';

import { validateAgentContract } from '../contract.js';

export const TB07Contract = validateAgentContract({
  id: 'TB-07',
  version: '1.0.0',
  module: 'MOD-04',
  purpose: 'planning',
  inputSchema: TB07Input,
  outputSchema: TB07Result,
  promptRef: { agent: 'TB-07', version: '1.0.0' },
  /** plan.author: generative content authoring with accessibility transformation. */
  model: 'plan.author',
  tools: [],
  guardrails: ['pii_guard'],
  budget: { maxTokens: 5000, maxCostUsd: 0.025 },
  evalSetRef: 'TB-07',
  requiresApproval: false,
  writesToBrain: false,
});
