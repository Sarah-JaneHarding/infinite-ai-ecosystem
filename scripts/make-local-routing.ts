#!/usr/bin/env tsx
/**
 * Writes a gateway routing file that sends every logical model to ONE provider, for
 * running the ecosystem on a free OpenAI-compatible endpoint (docs/FREE_LOCAL_TESTING.md).
 *
 *   pnpm routing:local --heavy qwen3:8b --light llama3.2:3b --embedding nomic-embed-text \
 *       --judge qwen3:8b --out apps/gateway/routing.local.json
 *
 * Flags: --heavy and --light are required; --provider (default `local`), --embedding,
 * --judge (model for guardrail.age_appropriateness), --out (default stdout).
 *
 * Exit codes: 0 written · 2 usage.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRoutingConfig } from '../apps/gateway/src/routing/config.js';
import {
  InvalidSingleProviderOptionsError,
  deriveSingleProviderRouting,
} from '../apps/gateway/src/routing/single-provider.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function usage(message: string): never {
  console.error(message);
  console.error(
    'Usage: pnpm routing:local --heavy <model> --light <model> [--provider local] [--embedding <model>] [--judge <model>] [--out FILE]',
  );
  process.exit(2);
}

const heavy = flag('heavy');
const light = flag('light');
if (heavy === undefined || light === undefined)
  usage('--heavy and --light are required.');

const shipped = parseRoutingConfig(
  JSON.parse(readFileSync(path.join(root, 'apps/gateway/routing.json'), 'utf8')),
);
const judge = flag('judge');
const embedding = flag('embedding');

try {
  const derived = deriveSingleProviderRouting(shipped, {
    provider: flag('provider') ?? 'local',
    heavyModel: heavy,
    lightModel: light,
    ...(embedding !== undefined ? { embeddingModel: embedding } : {}),
    ...(judge !== undefined
      ? { overrides: { 'guardrail.age_appropriateness': judge } }
      : {}),
  });
  const json = `${JSON.stringify(parseRoutingConfig(derived), null, 2)}\n`;
  const out = flag('out');
  if (out === undefined) process.stdout.write(json);
  else writeFileSync(path.resolve(out), json);
} catch (error) {
  if (error instanceof InvalidSingleProviderOptionsError) usage(error.message);
  throw error;
}
