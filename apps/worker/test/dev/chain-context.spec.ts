import { MOD01_CURRICULUM_PIPELINE } from '@infinite-ai/orchestrator';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@infinite-ai/db', () => ({
  listEffectiveConstitution: vi.fn(async () => [
    { kind: 'CAPS_CANON', key: 'caps-1' },
    { kind: 'ATP_CALENDAR', key: 'atp-1' },
    { kind: 'TEMPLATE', key: 'tpl-1' },
  ]),
  listStepRuns: vi.fn(async () => [
    {
      stepId: 'build-topic-graph',
      status: 'SUCCEEDED',
      input: {},
      output: { status: 'ok', framework: { grade: '4', ratifiedAt: null } },
    },
  ]),
}));

import {
  CHAIN_SPECS,
  DEV_CHAIN_ADDENDUM,
  assembleChainContext,
  makeChainPayloadBuilder,
  staticContextBuilder,
  type StepRunLike,
} from '../../src/dev/chain-context.js';
import { buildAgentContractMap } from '../../src/index.js';

const pipeline = MOD01_CURRICULUM_PIPELINE;
const constitution = [
  { kind: 'CAPS_CANON' },
  { kind: 'ATP_CALENDAR' },
  { kind: 'TEMPLATE' },
] as const;
const ok = (stepId: string, output: unknown, input: unknown = {}): StepRunLike => ({
  stepId,
  status: 'SUCCEEDED',
  input,
  output,
});

describe('CHAIN_SPECS', () => {
  it('only names agents that exist, and producers that exist', () => {
    const contracts = buildAgentContractMap();
    for (const [agentId, spec] of Object.entries(CHAIN_SPECS)) {
      expect(contracts.has(agentId)).toBe(true);
      for (const up of spec.upstream) expect(contracts.has(up.from)).toBe(true);
    }
  });

  it('only ever depends on an agent that runs earlier in the MOD-01 pipeline order', () => {
    const order = [
      'CE-01',
      'CE-02',
      'CE-03',
      'CE-04',
      'CE-05',
      'CE-08',
      'CE-06',
      'CE-07',
      'CE-09',
    ];
    for (const [agentId, spec] of Object.entries(CHAIN_SPECS)) {
      for (const up of spec.upstream) {
        expect(order.indexOf(up.from)).toBeLessThan(order.indexOf(agentId));
      }
    }
  });
});

describe('assembleChainContext', () => {
  it('grounds CE-01 on ratified CAPS documents only and has nothing to chain', () => {
    const result = assembleChainContext({
      agentId: 'CE-01',
      input: {},
      stepRuns: [],
      pipeline,
      constitution,
    });
    expect(result?.context['l0Documents']).toEqual([{ kind: 'CAPS_CANON' }]);
    expect(result?.provisional).toEqual([]);
  });

  it('chains CE-01 output into CE-02 as a provisional framework', () => {
    const result = assembleChainContext({
      agentId: 'CE-02',
      input: {},
      stepRuns: [ok('build-topic-graph', { status: 'ok', framework: { grade: '4' } })],
      pipeline,
      constitution,
    });
    expect(result?.context['framework']).toEqual({ grade: '4' });
    expect(result?.provisional).toEqual(['framework']);
    expect(result?.context['l0Documents']).toHaveLength(2);
  });

  it('treats an upstream needs_input result, or a failed step, as missing - never as an artefact', () => {
    const result = assembleChainContext({
      agentId: 'CE-02',
      input: {},
      stepRuns: [
        ok('build-topic-graph', { status: 'needs_input', missing: [] }),
        {
          ...ok('build-topic-graph', { status: 'ok', framework: { x: 1 } }),
          status: 'FAILED',
        },
      ],
      pipeline,
      constitution,
    });
    expect(result?.context['framework']).toBeUndefined();
    expect(result?.missing).toEqual(['framework']);
    expect(result?.context['devChain']).toMatchObject({ missingUpstream: ['framework'] });
  });

  it('feeds a map item only the producing items that match it, singular when exactly one', () => {
    const blueprint = (subject: string) => ({ status: 'ok', blueprint: { subject } });
    const result = assembleChainContext({
      agentId: 'CE-05',
      input: { subject: 'Mathematics', termNumber: 1 },
      stepRuns: [
        ok('architect-unit-item[0]', blueprint('Mathematics'), {
          subject: 'Mathematics',
          termNumber: 1,
        }),
        ok('architect-unit-item[1]', blueprint('English'), {
          subject: 'English',
          termNumber: 1,
        }),
      ],
      pipeline,
      constitution,
    });
    expect(result?.context['unitBlueprint']).toEqual({ subject: 'Mathematics' });
    expect(result?.context['unitBlueprints']).toBeUndefined();
  });

  it('gives every matching item under a plural key when more than one matches', () => {
    const result = assembleChainContext({
      agentId: 'CE-05',
      input: { subject: 'Mathematics', termNumber: 1 },
      stepRuns: [
        ok(
          'architect-unit-item[0]',
          { status: 'ok', blueprint: { n: 1 } },
          { subject: 'Mathematics', termNumber: 1 },
        ),
        ok(
          'architect-unit-item[1]',
          { status: 'ok', blueprint: { n: 2 } },
          { subject: 'Mathematics', termNumber: 1 },
        ),
      ],
      pipeline,
      constitution,
    });
    expect(result?.context['unitBlueprints']).toEqual([{ n: 1 }, { n: 2 }]);
    expect(result?.context['unitBlueprint']).toBeUndefined();
    expect(result?.provisional).toContain('unitBlueprints');
  });

  it('lets developer-supplied context win, and labels it as developer-supplied', () => {
    const result = assembleChainContext({
      agentId: 'CE-03',
      input: {},
      stepRuns: [],
      pipeline,
      constitution,
      extra: { assessmentPolicy: [{ doc: 'mine' }] },
    });
    expect(result?.context['assessmentPolicy']).toEqual([{ doc: 'mine' }]);
    expect(result?.context['devChain']).toMatchObject({
      devSupplied: ['assessmentPolicy'],
    });
  });

  it('never sets ratifiedAt on anything it adds', () => {
    const result = assembleChainContext({
      agentId: 'CE-02',
      input: {},
      stepRuns: [
        ok('build-topic-graph', { status: 'ok', framework: { ratifiedAt: null } }),
      ],
      pipeline,
      constitution,
    });
    expect(JSON.stringify(result?.context)).not.toMatch(/ratifiedAt":"/);
  });

  it('returns null for an agent with no spec, so production behaviour applies', () => {
    expect(
      assembleChainContext({
        agentId: 'TB-01',
        input: {},
        stepRuns: [],
        pipeline,
        constitution,
      }),
    ).toBeNull();
  });
});

describe('makeChainPayloadBuilder', () => {
  const tx = {} as never;

  it('sends { input, context } plus the calibration addendum for a spec agent', async () => {
    const build = makeChainPayloadBuilder({ tx, runId: 'r1', pipeline });
    const payload = await build({
      agentId: 'CE-02',
      stepId: 'sequence-atp',
      input: { grade: '4' },
    });
    expect(payload.systemSuffix).toBe(DEV_CHAIN_ADDENDUM);
    expect(payload.userContent).toMatchObject({
      input: { grade: '4' },
      context: { framework: { grade: '4', ratifiedAt: null } },
    });
  });

  it('sends the input unchanged, with no addendum, for an agent with no spec', async () => {
    const build = makeChainPayloadBuilder({ tx, runId: 'r1', pipeline });
    const payload = await build({ agentId: 'TB-01', stepId: 'x', input: { a: 1 } });
    expect(payload).toEqual({ userContent: { a: 1 } });
  });
});

describe('staticContextBuilder', () => {
  it('wraps the input with the developer context, labelled', async () => {
    const payload = await staticContextBuilder({ termPlan: { t: 1 } })({
      agentId: 'CE-04',
      stepId: 's',
      input: { a: 1 },
    });
    expect(payload.userContent).toMatchObject({
      input: { a: 1 },
      context: { termPlan: { t: 1 }, devChain: { devSupplied: ['termPlan'] } },
    });
  });
});
