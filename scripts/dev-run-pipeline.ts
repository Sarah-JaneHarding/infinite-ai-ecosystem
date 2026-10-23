#!/usr/bin/env tsx
/**
 * Starts a pipeline run for real (the worker must be running) and watches it.
 *
 *   pnpm dev:run-pipeline --list
 *   pnpm dev:run-pipeline --pipeline mod-01-curriculum --template
 *   pnpm dev:run-pipeline --pipeline mod-01-curriculum --input in.json [--out run.json]
 *   pnpm dev:run-pipeline --pipeline mod-01-curriculum --inspect <runId>
 *
 * Flags: --pipeline ID · --input FILE · --template · --list · --inspect RUN_ID ·
 * --tenant UUID (a seeded fixture tenant only) · --grade-phase FOUNDATION|INTERMEDIATE|SENIOR ·
 * --no-wait · --timeout-min N (default 30) · --out FILE (final inspection as JSON).
 *
 * A human gate is never decided here: the run waits, and a person with the gate's role
 * decides it in the web app (/approvals). This command keeps watching and reports the rest.
 *
 * Exit codes: 0 succeeded (or started with --no-wait) · 1 failed/cancelled/timed out ·
 * 2 usage, invalid input or refused.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { loadEnv } from '../packages/config/src/index.js';

import {
  DEFAULT_DEV_TENANT_ID,
  DEV_RUNNER_ACTOR_ID,
  DevRunnerRefusalError,
  assertDevRun,
} from '../apps/worker/src/dev/dev-guard.js';
import {
  PipelineRunnerError,
  TERMINAL_RUN_STATUSES,
  bindingFor,
  pipelineInputTemplate,
  readRun,
  startAndEnqueue,
  summariseRun,
  validatePipelineInput,
} from '../apps/worker/src/dev/pipeline-runner.js';
import { PIPELINE_QUEUE_BINDINGS } from '../apps/worker/src/pipeline-bindings.js';
import { buildAgentContractMap } from '../apps/worker/src/index.js';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function usage(message: string): never {
  console.error(message);
  console.error(
    'Usage: pnpm dev:run-pipeline (--list | --pipeline ID (--template | --input FILE | --inspect RUN_ID))',
  );
  process.exit(2);
}

if (has('list')) {
  for (const { queue, pipeline } of PIPELINE_QUEUE_BINDINGS) {
    console.log(`${pipeline.id}  (queue ${queue})`);
  }
  process.exit(0);
}

const pipelineId = flag('pipeline');
if (pipelineId === undefined) usage('--pipeline is required (see --list).');
const contracts = buildAgentContractMap();

try {
  const { pipeline } = bindingFor(pipelineId);

  if (has('template')) {
    console.log(JSON.stringify(pipelineInputTemplate(pipeline, contracts), null, 2));
    process.exit(0);
  }

  const env = loadEnv();
  const tenantId = flag('tenant') ?? DEFAULT_DEV_TENANT_ID;
  assertDevRun({ nodeEnv: env.NODE_ENV, tenantId });

  let runId = flag('inspect');
  if (runId === undefined) {
    const inputFile = flag('input');
    if (inputFile === undefined)
      usage('--input FILE, --template or --inspect is required.');
    const input: unknown = JSON.parse(readFileSync(inputFile, 'utf8'));
    const issues = validatePipelineInput(pipeline, contracts, input);
    if (issues.length > 0) {
      usage(`Input is not valid for ${pipeline.id}:\n  - ${issues.join('\n  - ')}`);
    }
    const phase = flag('grade-phase');
    if (
      phase !== undefined &&
      !['FOUNDATION', 'INTERMEDIATE', 'SENIOR'].includes(phase)
    ) {
      usage('--grade-phase must be FOUNDATION, INTERMEDIATE or SENIOR.');
    }
    const started = await startAndEnqueue({
      pipelineId,
      tenantId,
      actorId: DEV_RUNNER_ACTOR_ID,
      redisUrl: env.REDIS_URL,
      input,
      ...(phase === undefined
        ? {}
        : { gradePhase: phase as 'FOUNDATION' | 'INTERMEDIATE' | 'SENIOR' }),
    });
    runId = started.runId;
    console.log(`started run ${runId} on queue ${started.queue}`);
    if (has('no-wait')) process.exit(0);
  }

  const deadline = Date.now() + Number(flag('timeout-min') ?? '30') * 60_000;
  let last = '';
  for (;;) {
    const run = await readRun(tenantId, DEV_RUNNER_ACTOR_ID, runId, pipeline);
    if (run === null) usage(`No run ${runId} in tenant ${tenantId}.`);
    const summary = summariseRun(run);
    if (summary !== last) {
      console.log(summary);
      last = summary;
    }
    if (run.status === 'WAITING_FOR_APPROVAL' && !has('inspect')) {
      console.log(
        'Waiting for a person: decide the gate in the web app (/approvals) as the required role.',
      );
    }
    const finished =
      TERMINAL_RUN_STATUSES.includes(run.status) ||
      has('inspect') ||
      Date.now() > deadline;
    if (finished) {
      const out = flag('out');
      if (out !== undefined) writeFileSync(out, `${JSON.stringify(run, null, 2)}\n`);
      process.exit(run.status === 'SUCCEEDED' || has('inspect') ? 0 : 1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
} catch (error) {
  if (error instanceof DevRunnerRefusalError || error instanceof PipelineRunnerError) {
    usage(error.message);
  }
  throw error;
}
