// Unit tests — Stage 20 (Master Prompt Builder).
// Happy path + at least two failure paths per module area.

import { describe, expect, it } from 'vitest';

import type { LoadedPrompt } from '@infinite-ai/prompts';

import {
  PromptBuildError,
  PromptBudgetError,
  PromptVariableError,
  buildPrompt,
  enforceBudget,
  estimateTokens,
  extractVariables,
  substituteVariables,
} from '../src/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Builds a minimal LoadedPrompt fixture with all 8 required sections. */
function makePrompt(overrides?: Partial<LoadedPrompt>): LoadedPrompt {
  const body = `
# ROLE

You are a test agent.

# GROUNDING

Context: {{context}}.

# TASK

Do {{task}}.

# HARD CONSTRAINTS

Never lie.

# STYLE

Return JSON only.

# REFUSAL

Return error if context is missing.

# OUTPUT SCHEMA

\`\`\`json
{}
\`\`\`

# SELF-CHECK

Verify output is valid JSON.
`.trim();

  return {
    frontMatter: {
      agent: 'TEST-01',
      version: '1.0.0',
      model: 'curriculum.plan',
      changelog: 'Initial version',
      author: 'stage-20',
      ratified_by: null,
    },
    body,
    hash: 'abc123',
    ...overrides,
  };
}

// ─── variables.ts ─────────────────────────────────────────────────────────────

describe('extractVariables', () => {
  it('returns placeholders found in text', () => {
    const vars = extractVariables('Hello {{name}}, today is {{date}}.');
    expect(vars).toContain('name');
    expect(vars).toContain('date');
    expect(vars).toHaveLength(2);
  });

  it('deduplicates repeated placeholders', () => {
    const vars = extractVariables('{{x}} and {{x}} again');
    expect(vars).toHaveLength(1);
    expect(vars[0]).toBe('x');
  });

  it('returns empty array when no placeholders present', () => {
    expect(extractVariables('No placeholders here.')).toHaveLength(0);
  });

  it('ignores malformed placeholders (uppercase or spaces)', () => {
    const vars = extractVariables('{{Bad}} and {{two words}} are ignored');
    expect(vars).toHaveLength(0);
  });
});

describe('substituteVariables', () => {
  it('replaces all placeholders with supplied values', () => {
    const result = substituteVariables('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple distinct placeholders', () => {
    const result = substituteVariables('{{a}} + {{b}} = {{c}}', {
      a: '1',
      b: '2',
      c: '3',
    });
    expect(result).toBe('1 + 2 = 3');
  });

  it('throws PromptVariableError when a required variable is missing', () => {
    expect(() => substituteVariables('Hello {{name}}!', {})).toThrow(PromptVariableError);

    try {
      substituteVariables('Hello {{name}}!', {});
    } catch (err) {
      expect(err).toBeInstanceOf(PromptVariableError);
      expect((err as PromptVariableError).missing).toContain('name');
    }
  });

  it('throws PromptVariableError when an unknown variable is supplied', () => {
    expect(() =>
      substituteVariables('Hello {{name}}!', { name: 'A', typo: 'B' }),
    ).toThrow(PromptVariableError);

    try {
      substituteVariables('Hello {{name}}!', { name: 'A', typo: 'B' });
    } catch (err) {
      expect((err as PromptVariableError).unknown).toContain('typo');
    }
  });

  it('works when there are no placeholders and no variables supplied', () => {
    const result = substituteVariables('No placeholders.', {});
    expect(result).toBe('No placeholders.');
  });
});

// ─── budget.ts ────────────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('estimates 1 token per 4 characters', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2); // ceiling
  });

  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('enforceBudget', () => {
  const tinyBudget = { maxSystemTokens: 10, maxUserTokens: 10, maxOutputTokens: 100 };

  it('passes when both sides are within budget', () => {
    expect(() => enforceBudget('short', 'short', tinyBudget)).not.toThrow();
  });

  it('throws PromptBudgetError when system text exceeds budget', () => {
    const longSystem = 'x'.repeat(200); // 50 tokens >> 10
    expect(() => enforceBudget(longSystem, 'short', tinyBudget)).toThrow(
      PromptBudgetError,
    );

    try {
      enforceBudget(longSystem, 'short', tinyBudget);
    } catch (err) {
      expect((err as PromptBudgetError).section).toBe('system');
    }
  });

  it('throws PromptBudgetError when user text exceeds budget', () => {
    const longUser = 'x'.repeat(200);
    expect(() => enforceBudget('short', longUser, tinyBudget)).toThrow(PromptBudgetError);

    try {
      enforceBudget('short', longUser, tinyBudget);
    } catch (err) {
      expect((err as PromptBudgetError).section).toBe('user');
    }
  });
});

// ─── builder.ts ───────────────────────────────────────────────────────────────

describe('buildPrompt — happy path', () => {
  it('returns a BuiltPrompt with system and userTurn strings', () => {
    const prompt = makePrompt();
    const result = buildPrompt(prompt, { context: 'Gr4 Maths', task: 'plan a lesson' });
    expect(result.system).toContain('# ROLE');
    expect(result.system).toContain('# HARD CONSTRAINTS');
    expect(result.system).toContain('# STYLE');
    expect(result.system).toContain('# REFUSAL');
    expect(result.system).toContain('# OUTPUT SCHEMA');
    expect(result.system).toContain('# SELF-CHECK');
    expect(result.userTurn).toContain('# GROUNDING');
    expect(result.userTurn).toContain('# TASK');
  });

  it('GROUNDING and TASK do NOT appear in the system section', () => {
    const result = buildPrompt(makePrompt(), {
      context: 'ctx',
      task: 'do something',
    });
    expect(result.system).not.toContain('# GROUNDING');
    expect(result.system).not.toContain('# TASK');
  });

  it('ROLE, HARD CONSTRAINTS etc. do NOT appear in userTurn', () => {
    const result = buildPrompt(makePrompt(), {
      context: 'ctx',
      task: 'do something',
    });
    expect(result.userTurn).not.toContain('# ROLE');
    expect(result.userTurn).not.toContain('# HARD CONSTRAINTS');
  });

  it('substituted values appear in the assembled text', () => {
    const result = buildPrompt(makePrompt(), {
      context: 'Gr7 Science',
      task: 'write a quiz',
    });
    expect(result.userTurn).toContain('Gr7 Science');
    expect(result.userTurn).toContain('write a quiz');
  });

  it('sets source to "<agent>@<version>"', () => {
    const result = buildPrompt(makePrompt(), { context: 'c', task: 't' });
    expect(result.source).toBe('TEST-01@1.0.0');
  });

  it('carries maxOutputTokens from the budget', () => {
    const budget = { maxSystemTokens: 8000, maxUserTokens: 8000, maxOutputTokens: 1234 };
    const result = buildPrompt(makePrompt(), { context: 'c', task: 't' }, budget);
    expect(result.maxOutputTokens).toBe(1234);
  });
});

describe('buildPrompt — failure paths', () => {
  it('throws PromptVariableError when a placeholder is not supplied', () => {
    expect(() => buildPrompt(makePrompt(), { context: 'c' })).toThrow(
      PromptVariableError,
    );
  });

  it('throws PromptBudgetError when assembled system text exceeds budget', () => {
    const tinyBudget = { maxSystemTokens: 1, maxUserTokens: 8000, maxOutputTokens: 100 };
    expect(() =>
      buildPrompt(makePrompt(), { context: 'c', task: 't' }, tinyBudget),
    ).toThrow(PromptBudgetError);
  });

  it('throws PromptBudgetError when assembled user text exceeds budget', () => {
    const tinyBudget = { maxSystemTokens: 8000, maxUserTokens: 1, maxOutputTokens: 100 };
    expect(() =>
      buildPrompt(makePrompt(), { context: 'c', task: 't' }, tinyBudget),
    ).toThrow(PromptBudgetError);
  });

  it('throws PromptBuildError when a required section is missing from the body', () => {
    const badPrompt = makePrompt({
      body: makePrompt().body.replace(/^# SELF-CHECK[\s\S]*$/m, ''),
    });
    expect(() => buildPrompt(badPrompt, { context: 'c', task: 't' })).toThrow(
      PromptBuildError,
    );
  });
});
