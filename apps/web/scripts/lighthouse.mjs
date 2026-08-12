#!/usr/bin/env node
/**
 * Lightweight Lighthouse CI budget check.
 * Runs against http://localhost:3000/sign-in (always public, no auth needed).
 *
 * Budget thresholds from the Stage 14 exit gate:
 *   FCP < 1500ms (mid-range Android, throttled 3G)
 *   TBT < 300ms  (proxy for INP < 200ms)
 *
 * Requires the Next.js server to be running. Exit code 0 = budgets met,
 * exit code 1 = budgets exceeded or server unreachable.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const TARGET = 'http://localhost:3000/sign-in';
const LHR_PATH = '/tmp/lhr.json';

console.log(`Lighthouse budget check → ${TARGET}`);

try {
  execSync(
    `npx lighthouse ${TARGET} --output=json --output-path=${LHR_PATH} --quiet --chrome-flags="--headless" --only-categories=performance`,
    { stdio: 'inherit' },
  );
} catch {
  console.error('Lighthouse run failed. Is the dev server running?');
  process.exit(1);
}

if (!existsSync(LHR_PATH)) {
  console.error('Lighthouse report not written. Aborting.');
  process.exit(1);
}

/** @type {{ audits: Record<string, { numericValue: number }> }} */
const report = JSON.parse(readFileSync(LHR_PATH, 'utf-8'));

const fcp = report.audits['first-contentful-paint']?.numericValue ?? Infinity;
const tbt = report.audits['total-blocking-time']?.numericValue ?? Infinity;

const FCP_BUDGET = 1500;
const TBT_BUDGET = 300;

let fail = false;

if (fcp > FCP_BUDGET) {
  console.error(`FCP ${Math.round(fcp)}ms > budget ${FCP_BUDGET}ms`);
  fail = true;
} else {
  console.log(`FCP ${Math.round(fcp)}ms ✓`);
}

if (tbt > TBT_BUDGET) {
  console.error(`TBT ${Math.round(tbt)}ms > budget ${TBT_BUDGET}ms`);
  fail = true;
} else {
  console.log(`TBT ${Math.round(tbt)}ms ✓`);
}

process.exit(fail ? 1 : 0);
