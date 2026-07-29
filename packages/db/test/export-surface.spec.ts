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
    expect(Object.keys(db).sort()).toEqual([
      'DecryptionError',
      'EncryptionKey',
      'EncryptionKeyError',
      'InvalidTenantContextError',
      'NON_TENANT_TABLES',
      'PACKAGE_NAME',
      'SELF_KEYED_TENANT_TABLES',
      'TENANT_OWNED_TABLES',
      'decrypt',
      'disconnect',
      'encrypt',
      'lookupHash',
      'withTenant',
    ]);
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
