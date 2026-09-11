#!/usr/bin/env tsx
/**
 * CI guard for stale feature flags — Part 5 §5.1.
 *
 * Exits 1 if any flag in the registry has passed its expiresAt date.
 * Run as `pnpm check:flags` or in the forbidden-patterns CI job.
 *
 * A stale flag is a flag whose owner has not shipped, evaluated, or removed it
 * within the 90-day window. Failing CI is the signal to act; extending the date
 * without a review is explicitly forbidden (flags.ts header).
 */

import { expiredFlags } from '../packages/config/src/flags.js';

const today = new Date();
const stale = expiredFlags(today);

if (stale.length === 0) {
  console.log(
    `check:flags — all flags are within their expiry window (${today.toISOString().slice(0, 10)})`,
  );
  process.exit(0);
}

console.error(
  `check:flags — ${stale.length} expired flag(s) found as of ${today.toISOString().slice(0, 10)}:`,
);
for (const flag of stale) {
  console.error(`  ✗ ${flag.key}  (expired ${flag.expiresAt}, owner: ${flag.owner})`);
}
console.error('');
console.error('Rule: a flag older than its expiresAt is a CI error.');
console.error(
  'Action: ship behind the flag and remove it, or remove it if the feature is off.',
);
console.error('Do not extend expiresAt without a review.');
process.exit(1);
