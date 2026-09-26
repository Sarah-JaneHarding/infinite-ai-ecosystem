// createGatewayAgeAppropriatenessJudge's own dispatch and fail-closed behaviour — mocked
// against an injected gatewayCall so this tier needs no real gateway or network. Every
// failure mode is a dedicated test: this is the mechanism the whole safety posture of
// OQ-015 Gap 2 rests on, so "does it actually fail closed" is not left to inference from
// the happy-path test.

import type {
  AgeAppropriatenessSourceEntry,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@infinite-ai/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createGatewayAgeAppropriatenessJudge } from '../src/age-appropriateness-judge.js';
import type { DeidentificationProvenance } from '../src/pii-guard.js';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const PROMPT_BODY = '# ROLE\n\nYou are the Age-Appropriateness Judge.\n';
const PROVENANCE: DeidentificationProvenance = {
  deidentified: true,
  saltVersion: 0,
  dropped: [],
};

const CLAUSE: AgeAppropriatenessSourceEntry = {
  phase: 'FOUNDATION',
  gradeRange: 'R-3',
  subject: 'Life Skills',
  clauseType: 'progression',
  content: 'Content moves from simple to complex across the phase.',
  source: {
    documentId: 'age-appropriateness-src-life-skills',
    documentVersion: 'caps-current',
    clause: '1.3(c)',
    ratifiedBy: null,
  },
};

function fakeResponse(content: string): ChatCompletionResponse {
  return {
    id: 'resp-1',
    model: 'guardrail.age_appropriateness',
    provider: 'anthropic',
    message: { role: 'assistant', content },
    usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    cached: false,
  };
}

describe('createGatewayAgeAppropriatenessJudge', () => {
  it('returns an appropriate verdict when the gateway returns one', async () => {
    const gatewayCall = vi
      .fn()
      .mockResolvedValue(
        fakeResponse(
          JSON.stringify({ appropriate: true, rationale: 'Matches clause 1.3(c).' }),
        ),
      );
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'a simple story' });

    expect(verdict).toEqual({ appropriate: true, rationale: 'Matches clause 1.3(c).' });
    const [request] = gatewayCall.mock.calls[0] as [ChatCompletionRequest];
    expect(request.tenantId).toBe(TENANT_ID);
    expect(request.model).toBe('guardrail.age_appropriateness');
    expect(request.provenance).toEqual(PROVENANCE);
    expect(request.messages[0]).toEqual({ role: 'system', content: PROMPT_BODY });
    expect(JSON.parse(request.messages[1]!.content)).toEqual({
      clauses: [CLAUSE],
      output: { text: 'a simple story' },
    });
  });

  it('returns an inappropriate verdict with the rationale the gateway supplied', async () => {
    const gatewayCall = vi.fn().mockResolvedValue(
      fakeResponse(
        JSON.stringify({
          appropriate: false,
          rationale: 'Too advanced for R-3 per clause 1.3(c).',
        }),
      ),
    );
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'a complex proof' });

    expect(verdict).toEqual({
      appropriate: false,
      rationale: 'Too advanced for R-3 per clause 1.3(c).',
    });
  });

  // --- Fail-closed security tests: every way the gateway call can go wrong must resolve
  // to appropriate: false, never a thrown exception and never a silent pass. ---

  it('fails closed when the gateway call throws (network error)', async () => {
    const gatewayCall = vi
      .fn()
      .mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'anything' });

    expect(verdict.appropriate).toBe(false);
    expect(verdict.rationale).toContain('failing closed');
    expect(verdict.rationale).toContain('ECONNREFUSED');
  });

  it('fails closed when the gateway response content is not valid JSON', async () => {
    const gatewayCall = vi.fn().mockResolvedValue(fakeResponse('not json at all'));
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'anything' });

    expect(verdict.appropriate).toBe(false);
    expect(verdict.rationale).toContain('failing closed');
  });

  it('fails closed when the gateway response does not match the verdict schema', async () => {
    const gatewayCall = vi
      .fn()
      .mockResolvedValue(fakeResponse(JSON.stringify({ verdict: 'looks fine' })));
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'anything' });

    expect(verdict.appropriate).toBe(false);
    expect(verdict.rationale).toContain('failing closed');
  });

  it('fails closed when appropriate is present but not a boolean', async () => {
    const gatewayCall = vi
      .fn()
      .mockResolvedValue(
        fakeResponse(JSON.stringify({ appropriate: 'yes', rationale: 'looks fine' })),
      );
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    const verdict = await judge([CLAUSE], { text: 'anything' });

    expect(verdict.appropriate).toBe(false);
  });

  it('never throws out of the judge function itself, whatever the gateway does', async () => {
    const gatewayCall = vi.fn().mockRejectedValue('a non-Error rejection');
    const judge = createGatewayAgeAppropriatenessJudge(
      gatewayCall,
      TENANT_ID,
      PROMPT_BODY,
      PROVENANCE,
    );

    await expect(judge([CLAUSE], { text: 'anything' })).resolves.toMatchObject({
      appropriate: false,
    });
  });
});
