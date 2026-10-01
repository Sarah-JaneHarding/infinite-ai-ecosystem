#!/usr/bin/env tsx
/**
 * Runs the age-appropriateness labelled set through the real judge, via a running Model
 * Gateway, and prints how often it agrees with the labels (OQ-015 / OQ-016).
 *
 *   pnpm age-appropriateness:calibrate                       # reviewed cases only
 *   pnpm age-appropriateness:calibrate --include-unreviewed  # a dry run: NOT evidence
 *   pnpm age-appropriateness:calibrate --out report.json
 *
 * Flags: --gateway-url (default http://127.0.0.1:8080), --tenant (default: the first dev
 * seed tenant — it must exist, because the gateway reads that tenant's PII lexicon).
 *
 * It sets no pass mark: what agreement is good enough is the school's decision. By default
 * only cases a person confirmed or relabelled are scored, so until a human has reviewed
 * `packages/guardrails/calibration/age-appropriateness/cases.json` it refuses to run.
 * Every call goes through the gateway (rule 3); no provider key is read here.
 *
 * Exit codes: 0 report produced · 1 a case file is malformed or the set is inconsistent ·
 * 2 usage or nothing to score.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGE_APPROPRIATENESS_ENTRIES,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from '@infinite-ai/contracts';
import {
  LabelledCase,
  LabelledCoverage,
  checkLabelledSet,
  createGatewayAgeAppropriatenessJudge,
  runCalibration,
  selectCases,
  summariseCalibration,
  type DeidentificationProvenance,
} from '@infinite-ai/guardrails';
import { loadPromptFile } from '@infinite-ai/prompts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const calibrationDir = path.join(
  root,
  'packages/guardrails/calibration/age-appropriateness',
);
const DEFAULT_TENANT = '10000000-0000-4000-8000-000000000001';

// Honest for exactly this input: the labelled set is synthetic curriculum text with no
// learner data (rule 4). The gateway re-checks every payload against the tenant's lexicon
// regardless of what is stamped here.
const SYNTHETIC_CURRICULUM: DeidentificationProvenance = {
  deidentified: true,
  saltVersion: 0,
  dropped: [],
};

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function usage(message: string): never {
  console.error(message);
  console.error(
    'Usage: pnpm age-appropriateness:calibrate [--include-unreviewed] [--gateway-url URL] [--tenant UUID] [--out FILE]',
  );
  process.exit(2);
}

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(calibrationDir, name), 'utf8'));

let cases: LabelledCase[];
try {
  cases = LabelledCase.array().parse(readJson('cases.json'));
  const problems = checkLabelledSet(
    cases,
    LabelledCoverage.parse(readJson('coverage.json')),
    AGE_APPROPRIATENESS_ENTRIES,
  );
  if (problems.length > 0) {
    console.error(`The labelled set is inconsistent:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`Could not read the labelled set: ${String(error)}`);
  process.exit(1);
}

const includeUnreviewed = process.argv.includes('--include-unreviewed');
const { selected, excluded } = selectCases(cases, { includeUnreviewed });
if (selected.length === 0) {
  usage(
    `Nothing to score: all ${cases.length} cases are unreviewed or disputed. A person must ` +
      'review them first (see calibration/age-appropriateness/README.md); ' +
      '--include-unreviewed runs them anyway as a dry run.',
  );
}

const gatewayUrl = flag('gateway-url') ?? 'http://127.0.0.1:8080';
const tenant = flag('tenant') ?? DEFAULT_TENANT;
const prompt = loadPromptFile(
  path.join(root, 'packages/prompts/src/AGE-APPROPRIATENESS-JUDGE/1.0.0.prompt.md'),
);

const served = new Map<string, number>();
let promptTokens = 0;
let completionTokens = 0;

const judge = createGatewayAgeAppropriatenessJudge(
  async (request) => {
    const response = await fetch(`${gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ChatCompletionRequest.parse(request)),
    });
    if (!response.ok) {
      throw new Error(
        `Gateway returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`,
      );
    }
    const parsed = ChatCompletionResponse.parse(await response.json());
    const key = `${parsed.provider}/${parsed.model}`;
    served.set(key, (served.get(key) ?? 0) + 1);
    promptTokens += parsed.usage.promptTokens;
    completionTokens += parsed.usage.completionTokens;
    return parsed;
  },
  tenant,
  prompt.body,
  SYNTHETIC_CURRICULUM,
);

const results = await runCalibration(selected, AGE_APPROPRIATENESS_ENTRIES, judge);
const summary = summariseCalibration(results);

const report = {
  ranAt: new Date().toISOString(),
  gatewayUrl,
  promptVersion: prompt.frontMatter.version,
  servedBy: Object.fromEntries(served),
  tokens: { prompt: promptTokens, completion: completionTokens },
  excluded,
  summary,
  results,
};

const outFile = flag('out');
if (outFile !== undefined) writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

const pct = (a: { rate: number | null }): string =>
  a.rate === null ? 'n/a' : `${(a.rate * 100).toFixed(1)}%`;
console.log(
  [
    summary.humanReviewedOnly
      ? 'Scored cases are all human-reviewed.'
      : 'NOT CALIBRATION EVIDENCE: some scored cases are unreviewed (constructed, not human labels).',
    `Served by: ${[...served].map(([k, n]) => `${k} x${n}`).join(', ') || 'nothing'}  prompt ${prompt.frontMatter.version}`,
    `Cases scored: ${summary.scored} (excluded ${excluded.length})  no verdict: ${summary.noVerdict}`,
    `Agreement among verdicts: ${summary.overall.agreed}/${summary.overall.cases} = ${pct(summary.overall)}`,
    `Agreement counting no-verdict as a miss: ${summary.overallCountingNoVerdict.agreed}/${summary.overallCountingNoVerdict.cases} = ${pct(summary.overallCountingNoVerdict)}`,
    `Expected false: judged false ${summary.confusion.expectedFalseJudgedFalse}, judged true ${summary.confusion.expectedFalseJudgedTrue}`,
    `Expected true:  judged false ${summary.confusion.expectedTrueJudgedFalse}, judged true ${summary.confusion.expectedTrueJudgedTrue}`,
    ...Object.entries(summary.byKind).map(
      ([k, a]) => `  ${k}: ${a.agreed}/${a.cases} = ${pct(a)}`,
    ),
    ...summary.disagreements.map(
      (d) => `  DISAGREE ${d.caseId}: ${d.rationale.slice(0, 160)}`,
    ),
    ...summary.noVerdictCases.map(
      (d) => `  NO VERDICT ${d.caseId}: ${d.rationale.slice(0, 160)}`,
    ),
    outFile === undefined ? '' : `Full report: ${outFile}`,
  ]
    .filter((l) => l !== '')
    .join('\n'),
);
