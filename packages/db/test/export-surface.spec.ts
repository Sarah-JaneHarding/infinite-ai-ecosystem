// Stage 01 exit gate: "No export path to an unscoped client."
//
// Rule 5 is only as strong as what enforces it. There are three mechanisms — an ESLint
// rule banning `@prisma/client` imports outside this package, the module-private
// singleton in client.ts, and this test. This is the one that fails if someone adds a
// convenient `export { prisma }` while chasing a deadline.

import { describe, expect, it } from 'vitest';

import * as db from '../src/index.js';

describe('package export surface', () => {
  it('exports only the tenant-scoped entry point and its types', () => {
    // Every addition to this list is a deliberate edit to a test, which is the point.
    // Stage 03 added the consent ledger and erasure paths; each takes a `TenantClient` it
    // is handed rather than obtaining one, so none of them widens the surface that
    // matters. The structural check below is what actually guards the invariant.
    expect(Object.keys(db).sort()).toEqual([
      'APPEND_ONLY_TABLES',
      'BrainWriteError',
      'ConsentLedgerError',
      'DecryptionError',
      'EncryptionKey',
      'EncryptionKeyError',
      'ErasureError',
      'InvalidTenantContextError',
      'NON_TENANT_TABLES',
      'PACKAGE_NAME',
      'SELF_KEYED_TENANT_TABLES',
      'TENANT_OWNED_TABLES',
      'advanceBrainWrite',
      'appendConsentEntry',
      'commitBrainFact',
      'decrypt',
      'disconnect',
      'encrypt',
      'eraseSubject',
      'findEffectiveBrainFact',
      'getBrainWriteCandidate',
      'listOpenBrainWrites',
      'lookupHash',
      'openBrainWrite',
      'ratifyBrainWrite',
      'readLedger',
      'readTenantLedger',
      'readTenantLexicon',
      'withTenant',
    ]);
  });

  it('makes every data-touching export take a tenant client as its first argument', () => {
    // Rule 5 restated as a shape check. A function that could reach the database without
    // being handed a scoped transaction would be a second way in, and the export list
    // above only catches it if someone notices what the new name does.
    for (const fn of [
      db.appendConsentEntry,
      db.readLedger,
      db.readTenantLedger,
      db.eraseSubject,
      db.readTenantLexicon,
      db.openBrainWrite,
      db.getBrainWriteCandidate,
      db.listOpenBrainWrites,
      db.advanceBrainWrite,
      db.ratifyBrainWrite,
      db.findEffectiveBrainFact,
      db.commitBrainFact,
    ]) {
      expect(fn.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('exports no PrismaClient, under any name', () => {
    for (const [name, value] of Object.entries(db)) {
      expect(name.toLowerCase(), 'no export may be named after Prisma').not.toContain(
        'prisma',
      );
      // A Prisma client instance carries $connect. Catching it structurally means a
      // re-export under an innocuous name is caught too.
      expect(
        typeof value === 'object' && value !== null && '$connect' in value,
        `${name} looks like a Prisma client`,
      ).toBe(false);
    }
  });

  it('exposes no way to obtain a client outside a tenant scope', () => {
    // disconnect() is the only other function, and it returns void rather than a client.
    expect(typeof db.withTenant).toBe('function');
    expect(typeof db.disconnect).toBe('function');
    expect(db.withTenant.length).toBe(2);
  });
});
