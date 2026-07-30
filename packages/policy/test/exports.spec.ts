// What the package offers, and — more usefully — what it does not.

import { describe, expect, it } from 'vitest';

import * as policy from '../src/index.js';

describe('package export surface', () => {
  it('exports the decision functions and nothing that reaches a database', () => {
    expect(Object.keys(policy).sort()).toEqual([
      'APPROVAL_VALIDITY_HOURS',
      'Action',
      'Actor',
      'AuthorizationError',
      'ImpersonationRequest',
      'ImpersonationSession',
      'MAX_DURATION_MINUTES',
      'NEVER_GRANTED_VIA_RBAC',
      'PACKAGE_NAME',
      'PERMISSIONS',
      'PLATFORM_ROLES',
      'Resource',
      'ResourceType',
      'Role',
      'RoleGrant',
      'Scope',
      'TenantApproval',
      'assertAuthorized',
      'auditPayload',
      'authorize',
      'endImpersonation',
      'endsProcessing',
      'evaluateConsent',
      'impersonationBanner',
      'isEmpty',
      'isSessionActive',
      'relevantEntries',
      'resolveAccess',
      'startImpersonation',
      'unresolvedObjections',
    ]);
  });

  it('exports no zero-argument function, so nothing here decides on its own', () => {
    // Renamed from "offers no way to reach an ambient clock", which this check never
    // established and which the merged RBAC code makes plainly untrue: `authorize` and
    // `assertAuthorized` both default `now` to `new Date()`. Arity does not see a default.
    //
    // What it does establish is still worth having — a policy function taking no arguments
    // would have to be reading time or state from somewhere. The stronger property, that
    // the consent path never reads the clock itself, is asserted where it actually holds,
    // in consent.spec.ts, by evaluating the same ledger at different instants.
    for (const [name, value] of Object.entries(policy)) {
      if (typeof value !== 'function') continue;
      expect(
        value.length,
        `${name} takes no arguments, so it must read time or state`,
      ).toBeGreaterThan(0);
    }
  });
});
