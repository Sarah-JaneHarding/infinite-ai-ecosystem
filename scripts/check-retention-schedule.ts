#!/usr/bin/env tsx
/**
 * Checks a filled-in retention schedule before it goes near the database.
 *
 * `pnpm check:retention path/to/schedule.json`
 *
 * The form a school fills in is docs/RETENTION_SCHEDULE_TEMPLATE.md. This is the check that
 * sits between the signed page and the system enforcing it, because the failure mode here
 * is not a crash — it is a plausible-looking schedule quietly deleting the wrong records
 * two years from now.
 *
 * Exit codes:
 *   0  the schedule parses and every rule carries a real authority
 *   1  the schedule is malformed, or a rule rests on a placeholder authority
 *   2  usage
 *
 * Unscheduled categories are reported but do **not** fail the run. An incomplete schedule
 * is a legitimate and safe state — nothing in an unscheduled category is ever deleted
 * automatically. Failing on it would push a school toward inventing numbers to make the
 * tool stop complaining, which is precisely what this design exists to prevent.
 */

import { readFileSync } from 'node:fs';

import { reviewSchedule } from '@infinite-ai/contracts';

const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const DIM = '[2m';
const RESET = '[0m';

function usage(): never {
  console.error('Usage: pnpm check:retention <schedule.json>');
  console.error('Template: docs/RETENTION_SCHEDULE_TEMPLATE.md');
  process.exit(2);
}

function main(): void {
  const path = process.argv[2];
  if (path === undefined) usage();

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    console.error(`${RED}Cannot read ${path}${RESET}`);
    process.exit(2);
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch (error) {
    console.error(`${RED}${path} is not valid JSON${RESET}`);
    console.error(`  ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const review = reviewSchedule(candidate);

  if (!review.valid) {
    console.error(`${RED}The schedule does not parse.${RESET}`);
    for (const issue of review.issues) console.error(`  ✗ ${issue}`);
    process.exit(1);
  }

  console.log(
    `${GREEN}Parsed.${RESET} ${review.scheduled.length} of ` +
      `${review.scheduled.length + review.unscheduled.length} categories have a ratified rule.`,
  );

  for (const rule of review.schedule.rules) {
    console.log(
      `  ${GREEN}✓${RESET} ${rule.category.padEnd(21)} ` +
        `${String(rule.retainMonths).padStart(4)} months from ${rule.anchor}` +
        `${DIM}  — ${rule.authority}${RESET}`,
    );
  }

  if (review.unscheduled.length > 0) {
    console.log(
      `\n${YELLOW}Unscheduled — nothing in these is ever deleted automatically:${RESET}`,
    );
    for (const category of review.unscheduled) console.log(`  · ${category}`);
    console.log(
      `${DIM}Not an error. An incomplete schedule is a safe state; leaving a category out\n` +
        `is better than guessing a period for it. See OQ-007.${RESET}`,
    );
  }

  if (review.findings.length > 0) {
    console.error(`\n${RED}Rules that must not be loaded as they stand:${RESET}`);
    for (const finding of review.findings) {
      console.error(`  ✗ ${finding.category}: ${finding.detail}`);
    }
    console.error(
      `\nA rule with no real authority will still delete records. Fill in the source, or\n` +
        `remove the row until the school has one.`,
    );
    process.exit(1);
  }

  if (review.unscheduled.length === 0) {
    console.log(`\n${GREEN}Every category is scheduled.${RESET}`);
  }
}

main();
