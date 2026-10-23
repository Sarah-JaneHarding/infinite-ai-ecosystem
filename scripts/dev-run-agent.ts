#!/usr/bin/env tsx
/**
 * Runs ONE agent against the live Model Gateway and prints/saves the full record.
 *
 *   pnpm dev:run-agent --agent CE-01 --template            # print an input skeleton
 *   pnpm dev:run-agent --agent CE-01 --input in.json       # run it
 *   pnpm dev:run-agent --agent CE-01 --input in.json --out runs/ce01.jsonl
 *
 * Flags: --agent (required), --input FILE, --template, --tenant UUID (a seeded fixture
 * tenant only), --out FILE (JSON lines, appended), --send-invalid (call the model even if
 * the input fails the agent's schema). Needs the gateway running (docs/FREE_LOCAL_TESTING.md).
 *
 * Exit codes: 0 call returned an `ok` outcome · 1 any other outcome · 2 usage / refused.
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadEnv } from '../packages/config/src/index.js';

import {
  DEFAULT_DEV_TENANT_ID,
  DevRunnerRefusalError,
  assertDevRun,
} from '../apps/worker/src/dev/dev-guard.js';
import { AgentRunnerError, runAgentLive } from '../apps/worker/src/dev/agent-runner.js';
import { templateFor } from '../apps/worker/src/dev/schema-template.js';
import { buildAgentContractMap } from '../apps/worker/src/index.js';

const promptsRoot = path.resolve(import.meta.dirname, '../packages/prompts/src');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function usage(message: string): never {
  console.error(message);
  console.error(
    'Usage: pnpm dev:run-agent --agent <ID> (--template | --input FILE) [--tenant UUID] [--out FILE] [--send-invalid]',
  );
  process.exit(2);
}

const agentId = flag('agent');
if (agentId === undefined) usage('--agent is required.');
const contracts = buildAgentContractMap();
const contract = contracts.get(agentId);
if (contract === undefined) {
  usage(`Unknown agent "${agentId}". Known: ${[...contracts.keys()].sort().join(', ')}`);
}

if (has('template')) {
  console.log(JSON.stringify(templateFor(contract.inputSchema), null, 2));
  process.exit(0);
}
const inputFile = flag('input');
if (inputFile === undefined) usage('--input FILE (or --template) is required.');

const env = loadEnv();
const tenantId = flag('tenant') ?? DEFAULT_DEV_TENANT_ID;
try {
  assertDevRun({ nodeEnv: env.NODE_ENV, tenantId });
  const input: unknown = JSON.parse(readFileSync(inputFile, 'utf8'));
  const record = await runAgentLive(
    {
      contracts,
      promptsRoot,
      gatewayBaseUrl: env.GATEWAY_BASE_URL,
      tenantId,
      sendInvalidInput: has('send-invalid'),
    },
    agentId,
    input,
    path.basename(inputFile),
  );
  const out = flag('out');
  if (out !== undefined) {
    mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    appendFileSync(out, `${JSON.stringify(record)}\n`);
  }
  console.log(JSON.stringify(record, null, 2));
  process.exit(record.outcome === 'ok' ? 0 : 1);
} catch (error) {
  if (error instanceof DevRunnerRefusalError || error instanceof AgentRunnerError) {
    usage(error.message);
  }
  throw error;
}
