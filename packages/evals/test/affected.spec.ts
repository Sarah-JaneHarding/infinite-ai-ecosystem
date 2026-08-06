import { describe, expect, it } from 'vitest';

import { affectedAgentIds, classifyChange } from '../src/affected.js';

describe('classifyChange', () => {
  it('classifies a prompt file as affecting its own agent id', () => {
    expect(classifyChange('packages/prompts/src/CE-05/1.0.0.prompt.md')).toEqual({
      kind: 'agent',
      agentId: 'CE-05',
    });
  });

  it('classifies an agent contract file as affecting its own agent id', () => {
    expect(classifyChange('packages/agents/src/mod-01/CE-05.contract.ts')).toEqual({
      kind: 'agent',
      agentId: 'CE-05',
    });
  });

  it('classifies a guardrails file as cross-cutting', () => {
    expect(classifyChange('packages/guardrails/src/output-checks.ts')).toEqual({
      kind: 'cross_cutting',
    });
  });

  it('classifies a brain (retrieval) file as cross-cutting', () => {
    expect(classifyChange('packages/brain/src/retrieval-assembly.ts')).toEqual({
      kind: 'cross_cutting',
    });
  });

  it('classifies a policy file as cross-cutting', () => {
    expect(classifyChange('packages/policy/src/access.ts')).toEqual({
      kind: 'cross_cutting',
    });
  });

  it('classifies an unrelated file as having no effect', () => {
    expect(classifyChange('docs/STAGE_LOG.md')).toEqual({ kind: 'none' });
  });

  it('does not misclassify a guardrails file as belonging to an agent', () => {
    const impact = classifyChange('packages/guardrails/src/engine.ts');
    expect(impact.kind).toBe('cross_cutting');
  });
});

describe('affectedAgentIds', () => {
  it('returns an empty list when nothing in the changed files matters', () => {
    expect(affectedAgentIds(['docs/STAGE_LOG.md', 'README.md'])).toEqual([]);
  });

  it('returns the specific agent ids named by prompt/contract changes', () => {
    const result = affectedAgentIds([
      'packages/prompts/src/CE-05/1.0.0.prompt.md',
      'packages/agents/src/mod-01/CE-06.contract.ts',
    ]);
    expect(result).not.toBe('all');
    expect([...(result as readonly string[])].sort()).toEqual(['CE-05', 'CE-06']);
  });

  it('deduplicates the same agent named by more than one changed file', () => {
    const result = affectedAgentIds([
      'packages/prompts/src/CE-05/1.0.0.prompt.md',
      'packages/prompts/src/CE-05/1.1.0.prompt.md',
    ]);
    expect(result).toEqual(['CE-05']);
  });

  it('returns "all" the moment any cross-cutting file changed, ignoring specific matches', () => {
    const result = affectedAgentIds([
      'packages/prompts/src/CE-05/1.0.0.prompt.md',
      'packages/guardrails/src/engine.ts',
    ]);
    expect(result).toBe('all');
  });
});
