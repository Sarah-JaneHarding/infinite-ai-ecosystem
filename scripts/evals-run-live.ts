#!/usr/bin/env tsx
/**
 * Runs golden sets against the LIVE gateway and saves every raw reply for calibration.
 *
 *   pnpm evals:run-live --agent CE-05 --limit 5
 *   pnpm evals:run-live --module CE
 *   pnpm evals:run-live --all --limit 3        # a sample of every agent
 *
 * Writes <out>/calls.jsonl (one record per model call: input, raw reply, usage, latency,
 * outcome) and <out>/summary.json (per-case status). Unlike `pnpm evals:run` (stub
 * executors, no model) this spends model time, so choose a scope: --agent, --module or --all.
 *
 * Flags: --agent ID · --module CE|AC|DW|TB|LE|PD · --all · --limit N (cases per agent) ·
 * --out DIR (default runs/evals-live-<timestamp>) · --tenant UUID (fixture tenant only) ·
 * --send-invalid (call the model even when an input fails the agent's schema).
 *
 * Exit codes: 0 finished (scores are data, not a gate) · 2 usage / refused / gateway down.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { loadAllEvalSets } from '@infinite-ai/evals';

import { loadEnv } from '../packages/config/src/index.js';
import { runAgentLive } from '../apps/worker/src/dev/agent-runner.js';
import {
  DEFAULT_DEV_TENANT_ID,
  DevRunnerRefusalError,
  assertDevRun,
} from '../apps/worker/src/dev/dev-guard.js';
import { runLiveEval, type LiveEvalSummary } from '../apps/worker/src/dev/live-eval.js';
import { buildAgentContractMap } from '../apps/worker/src/index.js';

const root = path.resolve(import.meta.dirname, '..');
const promptsRoot = path.join(root, 'packages/prompts/src');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function usage(message: string): never {
  console.error(message);
  console.error(
    'Usage: pnpm evals:run-live (--agent ID | --module XX | --all) [--limit N] [--out DIR] [--tenant UUID] [--send-invalid]',
  );
  process.exit(2);
}

const sets = loadAllEvalSets(path.join(root, 'packages/evals/sets'));
const contracts = buildAgentContractMap();
const agentFlag = flag('agent');
const moduleFlag = flag('module');
if (agentFlag === undefined && moduleFlag === undefined && !has('all')) {
  usage('Choose a scope: --agent, --module or --all.');
}
const agentIds = [...sets.keys()]
  .filter((id) =>
    has('all')
      ? true
      : agentFlag !== undefined
        ? id === agentFlag
        : id.startsWith(`${moduleFlag}-`),
  )
  .sort();
if (agentIds.length === 0) usage('No golden sets match that scope.');
const limitText = flag('limit');
const limit = limitText === undefined ? Number.POSITIVE_INFINITY : Number(limitText);
if (Number.isNaN(limit) || limit < 1) usage('--limit must be a positive number.');

const env = loadEnv();
const tenantId = flag('tenant') ?? DEFAULT_DEV_TENANT_ID;
try {
  assertDevRun({ nodeEnv: env.NODE_ENV, tenantId });
} catch (error) {
  if (error instanceof DevRunnerRefusalError) usage(error.message);
  throw error;
}

const health = await fetch(`${env.GATEWAY_BASE_URL}/health`).catch(() => null);
if (health === null || !health.ok) {
  usage(
    `The gateway is not answering at ${env.GATEWAY_BASE_URL}/health - start it first.`,
  );
}

const outDir = path.resolve(
  flag('out') ?? `runs/evals-live-${new Date().toISOString().replace(/[:.]/g, '-')}`,
);
mkdirSync(outDir, { recursive: true });
const callsFile = path.join(outDir, 'calls.jsonl');

const summaries: LiveEvalSummary[] = [];
for (const agentId of agentIds) {
  const contract = contracts.get(agentId);
  const cases = (sets.get(agentId) ?? []).slice(0, limit);
  if (contract === undefined) {
    console.log(`${agentId}: golden set found but no agent contract - skipped.`);
    continue;
  }
  const summary = await runLiveEval(agentId, contract.version, cases, {
    runCase: (evalCase) =>
      runAgentLive(
        {
          contracts,
          promptsRoot,
          gatewayBaseUrl: env.GATEWAY_BASE_URL,
          tenantId,
          sendInvalidInput: has('send-invalid'),
        },
        agentId,
        evalCase.input,
        evalCase.id,
      ),
    onRecord: (record) => appendFileSync(callsFile, `${JSON.stringify(record)}\n`),
  });
  summaries.push(summary);
  const c = summary.counts;
  console.log(
    `${agentId}: ${cases.length} cases - passed ${c.passed}, failed ${c.failed}, ` +
      `unscored ${c.unscored}, call_failed ${c.call_failed}`,
  );
}
writeFileSync(
  path.join(outDir, 'summary.json'),
  `${JSON.stringify(summaries, null, 2)}\n`,
);
console.log(
  `\nraw replies: ${callsFile}\nsummary:     ${path.join(outDir, 'summary.json')}`,
);
