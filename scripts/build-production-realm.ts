#!/usr/bin/env tsx
/**
 * Builds the production Keycloak realm file from the development one.
 *
 *   pnpm keycloak:production-realm            writes infra/keycloak/realm.production.json
 *   pnpm keycloak:production-realm --check    writes nothing; exits 1 if the committed file is stale
 *
 * `realm.json` is a development fixture (eleven `*.dev` users, a localhost redirect). The rule that turns
 * it into something safe to import into production lives in
 * `packages/policy/src/keycloak-production-realm.ts`; this script only reads, applies it and writes.
 * Import `realm.production.json` into production, never `realm.json` (docs/RUNBOOKS/verify-mfa.md, Part B).
 *
 * Exit codes: 0 ok · 1 the committed file is stale, or the dev realm cannot be made safe · 2 usage
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { toProductionRealm } from '../packages/policy/src/keycloak-production-realm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'infra', 'keycloak', 'realm.json');
const TARGET = join(ROOT, 'infra', 'keycloak', 'realm.production.json');

function render(): string {
  const dev: unknown = JSON.parse(readFileSync(SOURCE, 'utf8'));
  return JSON.stringify(toProductionRealm(dev), null, 2) + '\n';
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  if (args.some((a) => a !== '--check')) {
    console.error('usage: pnpm keycloak:production-realm [--check]');
    process.exit(2);
  }

  let out: string;
  try {
    out = render();
  } catch (error) {
    console.error(
      `Cannot build the production realm: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  if (check) {
    let current = '';
    try {
      current = readFileSync(TARGET, 'utf8');
    } catch {
      console.error(`${TARGET} does not exist. Run: pnpm keycloak:production-realm`);
      process.exit(1);
    }
    // Compared as data, not text, so formatting (Prettier) never causes a false alarm.
    if (JSON.stringify(JSON.parse(current)) !== JSON.stringify(JSON.parse(out))) {
      console.error(
        'infra/keycloak/realm.production.json is out of date. Run: pnpm keycloak:production-realm',
      );
      process.exit(1);
    }
    console.log('realm.production.json matches realm.json.');
    return;
  }

  writeFileSync(TARGET, out);
  console.log(
    'Wrote infra/keycloak/realm.production.json (no dev users, no loopback redirects).',
  );
  console.log('Import THIS file into production, never realm.json.');
}

main();
